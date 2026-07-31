import test from "node:test";
import assert from "node:assert/strict";
import { computeSessionExpiration, createAtomicCheckoutSession } from "../lib/checkout/atomic.ts";

function createDbMock(options?: {
  reserve?: { data?: unknown; error?: { message: string } | null };
  releaseError?: { message: string } | null;
  updateErrors?: Array<{ message: string } | null>;
}) {
  const updates: Array<{ table: string; values: Record<string, unknown>; column: string; value: string }> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const updateErrors = [...(options?.updateErrors ?? [])];

  return {
    updates,
    rpcCalls,
    db: {
      async rpc(name: string, args: Record<string, unknown>) {
        rpcCalls.push({ name, args });

        if (name === "reserve_checkout_inventory") {
          return options?.reserve ?? {
            data: [{
              reservation_id: "res-1",
              expires_at: "2026-01-01T12:30:00.000Z",
              product_ids: ["11111111-1111-4111-8111-111111111111"],
              product_details: [{
                id: "11111111-1111-4111-8111-111111111111",
                title: "Shiftry",
                price_cents: 1500,
                category: "single",
                shipping_class: "card"
              }]
            }],
            error: null
          };
        }

        if (name === "release_checkout_inventory") {
          return { data: null, error: options?.releaseError ?? null };
        }

        throw new Error(`Unexpected rpc ${name}`);
      },
      from(table: string) {
        return {
          update(values: Record<string, unknown>) {
            return {
              async eq(column: string, value: string) {
                updates.push({ table, values, column, value });
                return { error: updateErrors.shift() ?? null };
              }
            };
          }
        };
      }
    }
  };
}

function createStripeMock(sessionFactory?: (params: Record<string, unknown>) => Promise<{ id: string; url: string | null }>) {
  const calls: Record<string, unknown>[] = [];

  return {
    calls,
    stripe: {
      checkout: {
        sessions: {
          async create(params: Record<string, unknown>) {
            calls.push(params);
            if (sessionFactory) return sessionFactory(params);
            return { id: "cs_test_123", url: "https://checkout.stripe.test/session" };
          }
        }
      }
    }
  };
}

test("normal single checkout keeps $5 shipping and extends the reservation expiry when needed", async () => {
  const dbMock = createDbMock();
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    now: new Date("2026-01-01T12:00:05.000Z"),
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, true);
  assert.equal(stripeMock.calls.length, 1);
  assert.equal((stripeMock.calls[0].shipping_options as Array<{ shipping_rate_data: { fixed_amount: { amount: number } } }>)[0].shipping_rate_data.fixed_amount.amount, 500);
  assert.equal(dbMock.updates[0].table, "inventory_reservations");
  assert.ok(dbMock.updates.every((update) => update.table === "inventory_reservations"));
  assert.equal((stripeMock.calls[0].expires_at as number), Math.floor(new Date("2026-01-01T12:35:05.000Z").getTime() / 1000));
  assert.ok(String((stripeMock.calls[0].metadata as Record<string, unknown>).product_ids).includes("11111111-1111-4111-8111-111111111111"));
  assert.equal("promotion_type" in (stripeMock.calls[0].metadata as Record<string, unknown>), false);
});

test("sealed checkout keeps $15 shipping", async () => {
  const dbMock = createDbMock({
    reserve: {
      data: [{
        reservation_id: "res-2",
        expires_at: "2026-01-01T12:40:00.000Z",
        product_ids: ["22222222-2222-4222-8222-222222222222"],
        product_details: [{
          id: "22222222-2222-4222-8222-222222222222",
          title: "Sealed Box",
          price_cents: 10000,
          category: "sealed",
          shipping_class: "sealed"
        }]
      }],
      error: null
    }
  });
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["22222222-2222-4222-8222-222222222222"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    now: new Date("2026-01-01T12:00:00.000Z"),
    getShippingAmount: () => 1500,
    getShippingLabel: () => "Sealed or mixed-order shipping"
  });

  assert.equal(result.ok, true);
  assert.equal((stripeMock.calls[0].shipping_options as Array<{ shipping_rate_data: { fixed_amount: { amount: number } } }>)[0].shipping_rate_data.fixed_amount.amount, 1500);
});

test("a second concurrent reservation failure returns a friendly 409 while the product remains available to browse", async () => {
  const dbMock = createDbMock({
    reserve: {
      data: null,
      error: { message: "Another shopper is currently checking out this card. Please try again shortly." }
    }
  });
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
    assert.match(result.error, /currently checking out/i);
  }
  assert.equal(stripeMock.calls.length, 0);
});

test("stripe session creation failure releases the reservation", async () => {
  const dbMock = createDbMock();
  const stripeMock = createStripeMock(async () => {
    throw new Error("expires_at must be at least 30 minutes in the future");
  });
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    now: new Date("2026-01-01T12:00:05.000Z"),
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, false);
  assert.ok(dbMock.rpcCalls.some((call) => call.name === "release_checkout_inventory"));
  assert.ok(dbMock.updates.every((update) => update.table === "inventory_reservations"));
});

test("blank ordinary checkout contains no promo behavior", async () => {
  const dbMock = createDbMock();
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, true);
  assert.equal("promotion_type" in (stripeMock.calls[0].metadata as Record<string, unknown>), false);
});

test("eligible manually entered code gets free shipping and still collects the shipping address", async () => {
  const dbMock = createDbMock();
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    promoCode: "family",
    familyFreeShippingCode: "FAMILY",
    now: new Date("2026-01-01T12:00:05.000Z"),
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, true);
  assert.equal("shipping_options" in stripeMock.calls[0], false);
  assert.deepEqual(stripeMock.calls[0].shipping_address_collection, { allowed_countries: ["US"] });
  assert.equal((stripeMock.calls[0].metadata as Record<string, unknown>).promotion_type, "family_free_shipping");
});

test("lowercase promo entry works", async () => {
  const dbMock = createDbMock();
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    promoCode: "family",
    familyFreeShippingCode: "FaMiLy",
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, true);
  assert.equal((stripeMock.calls[0].metadata as Record<string, unknown>).promotion_type, "family_free_shipping");
});

test("invalid code releases reservation", async () => {
  const dbMock = createDbMock();
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    promoCode: "wrong",
    familyFreeShippingCode: "family",
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.error, "Promo code is invalid.");
  }
  assert.ok(dbMock.rpcCalls.some((call) => call.name === "release_checkout_inventory"));
  assert.ok(dbMock.updates.every((update) => update.table === "inventory_reservations"));
  assert.equal(stripeMock.calls.length, 0);
});

test("over-$25 promo attempt releases reservation", async () => {
  const dbMock = createDbMock({
    reserve: {
      data: [{
        reservation_id: "res-3",
        expires_at: "2026-01-01T12:30:00.000Z",
        product_ids: ["33333333-3333-4333-8333-333333333333"],
        product_details: [{
          id: "33333333-3333-4333-8333-333333333333",
          title: "Slab",
          price_cents: 2600,
          category: "slab",
          shipping_class: "card"
        }]
      }],
      error: null
    }
  });
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["33333333-3333-4333-8333-333333333333"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    promoCode: "family",
    familyFreeShippingCode: "family",
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
  }
  assert.ok(dbMock.rpcCalls.some((call) => call.name === "release_checkout_inventory"));
  assert.ok(dbMock.updates.every((update) => update.table === "inventory_reservations"));
  assert.equal(stripeMock.calls.length, 0);
});

test("sealed promo attempt releases reservation", async () => {
  const dbMock = createDbMock({
    reserve: {
      data: [{
        reservation_id: "res-4",
        expires_at: "2026-01-01T12:30:00.000Z",
        product_ids: ["44444444-4444-4444-8444-444444444444"],
        product_details: [{
          id: "44444444-4444-4444-8444-444444444444",
          title: "Sealed Tin",
          price_cents: 2000,
          category: "sealed",
          shipping_class: "sealed"
        }]
      }],
      error: null
    }
  });
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["44444444-4444-4444-8444-444444444444"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    promoCode: "family",
    familyFreeShippingCode: "family",
    getShippingAmount: () => 1500,
    getShippingLabel: () => "Sealed or mixed-order shipping"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
  }
  assert.ok(dbMock.rpcCalls.some((call) => call.name === "release_checkout_inventory"));
  assert.ok(dbMock.updates.every((update) => update.table === "inventory_reservations"));
  assert.equal(stripeMock.calls.length, 0);
});

test("missing environment variable returns a generic error and releases reservation", async () => {
  const dbMock = createDbMock();
  const stripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const result = await createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
    db: dbMock.db,
    stripe: stripeMock.stripe,
    baseUrl: "https://example.com",
    logger,
    promoCode: "family",
    familyFreeShippingCode: "",
    getShippingAmount: () => 500,
    getShippingLabel: () => "Tracked card/slab shipping"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 500);
    assert.equal(result.error, "Promo code is unavailable right now.");
  }
  assert.ok(dbMock.rpcCalls.some((call) => call.name === "release_checkout_inventory"));
  assert.ok(dbMock.updates.every((update) => update.table === "inventory_reservations"));
  assert.equal(stripeMock.calls.length, 0);
});

test("two concurrent eligible checkouts still produce one Stripe success and one 409", async () => {
  const successDbMock = createDbMock();
  const failDbMock = createDbMock({
    reserve: {
      data: null,
      error: { message: "Another shopper is currently checking out this card. Please try again shortly." }
    }
  });
  const successStripeMock = createStripeMock();
  const failStripeMock = createStripeMock();
  const logger = { error() {}, warn() {} };

  const [successResult, failureResult] = await Promise.all([
    createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
      db: successDbMock.db,
      stripe: successStripeMock.stripe,
      baseUrl: "https://example.com",
      logger,
      promoCode: "family",
      familyFreeShippingCode: "family",
      getShippingAmount: () => 500,
      getShippingLabel: () => "Tracked card/slab shipping"
    }),
    createAtomicCheckoutSession(["11111111-1111-4111-8111-111111111111"], {
      db: failDbMock.db,
      stripe: failStripeMock.stripe,
      baseUrl: "https://example.com",
      logger,
      promoCode: "family",
      familyFreeShippingCode: "family",
      getShippingAmount: () => 500,
      getShippingLabel: () => "Tracked card/slab shipping"
    })
  ]);

  assert.equal(successResult.ok, true);
  assert.equal(failureResult.ok, false);
  if (!failureResult.ok) {
    assert.equal(failureResult.status, 409);
  }
  assert.equal(successStripeMock.calls.length, 1);
  assert.equal(failStripeMock.calls.length, 0);
});

test("computeSessionExpiration extends a reservation to a 35-minute safety window above Stripe's minimum", () => {
  const expiration = computeSessionExpiration("2026-01-01T12:30:00.000Z", new Date("2026-01-01T12:00:05.000Z"));

  assert.equal(expiration.shouldExtendReservation, true);
  assert.equal(expiration.sessionExpiresAt, Math.floor(new Date("2026-01-01T12:35:05.000Z").getTime() / 1000));
  assert.ok(expiration.sessionExpiresAt - expiration.stripeMinimumRequirement >= 5 * 60);
});