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
  assert.equal((stripeMock.calls[0].expires_at as number), Math.floor(new Date("2026-01-01T12:35:05.000Z").getTime() / 1000));
  assert.ok(String((stripeMock.calls[0].metadata as Record<string, unknown>).product_ids).includes("11111111-1111-4111-8111-111111111111"));
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

test("a second concurrent reservation failure returns 409 unavailable", async () => {
  const dbMock = createDbMock({
    reserve: {
      data: null,
      error: { message: "Shiftry is already reserved or sold." }
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
    assert.match(result.error, /reserved or sold/i);
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
  assert.equal("promo_code" in (stripeMock.calls[0].metadata as Record<string, unknown>), false);
});

test("computeSessionExpiration extends a reservation to a 35-minute safety window above Stripe's minimum", () => {
  const expiration = computeSessionExpiration("2026-01-01T12:30:00.000Z", new Date("2026-01-01T12:00:05.000Z"));

  assert.equal(expiration.shouldExtendReservation, true);
  assert.equal(expiration.sessionExpiresAt, Math.floor(new Date("2026-01-01T12:35:05.000Z").getTime() / 1000));
  assert.ok(expiration.sessionExpiresAt - expiration.stripeMinimumRequirement >= 5 * 60);
});