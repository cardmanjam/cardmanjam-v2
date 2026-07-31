import Stripe from "stripe";

export type ReservedProduct = {
  id: string;
  title: string;
  price_cents: number;
  category: "single" | "slab" | "sealed";
  shipping_class: "card" | "sealed";
};

type RpcResult<T> = {
  data?: T | null;
  error?: { message: string } | null;
};

type Awaitable<T> = PromiseLike<T>;

type UpdateResult = {
  error?: { message: string } | null;
};

export type ReservationRow = {
  reservation_id: string;
  expires_at: string;
  product_ids: string[];
  product_details: ReservedProduct[];
};

export type CheckoutDb = {
  rpc: (name: string, args: Record<string, unknown>) => Awaitable<RpcResult<ReservationRow[] | ReservationRow>>;
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Awaitable<UpdateResult>;
    };
  };
};

export type CheckoutStripe = {
  checkout: {
    sessions: {
      create: (params: Stripe.Checkout.SessionCreateParams) => Promise<{ id: string; url: string | null }>;
    };
  };
};

type Logger = Pick<Console, "error" | "warn">;

type CheckoutDependencies = {
  db: CheckoutDb;
  stripe: CheckoutStripe;
  baseUrl: string;
  logger: Logger;
  now?: Date;
  promoCode?: unknown;
  familyFreeShippingCode?: string;
  getShippingAmount: (items: ReservedProduct[]) => number;
  getShippingLabel: (items: ReservedProduct[]) => string;
};

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

const STRIPE_MINIMUM_EXPIRATION_SECONDS = 30 * 60;
const RESERVATION_EXPIRATION_BUFFER_SECONDS = 35 * 60;
const FAMILY_FREE_SHIPPING_PROMOTION_TYPE = "family_free_shipping";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizePromoCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function normalizeProductIds(productIds: unknown) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { ids: [] as string[], status: 400, error: "Cart is empty." };
  }

  const normalizedIds = [...new Set(productIds.filter((id): id is string => typeof id === "string" && isUuid(id)))];
  if (normalizedIds.length === 0) {
    return { ids: [] as string[], status: 400, error: "Cart is empty or contains invalid product IDs." };
  }

  return { ids: normalizedIds, status: 200, error: null };
}

export function computeSessionExpiration(reservationExpiresAt: string, now = new Date()) {
  const reservationExpiresAtSeconds = Math.floor(new Date(reservationExpiresAt).getTime() / 1000);
  const minimumStripeExpiration = Math.floor(now.getTime() / 1000) + RESERVATION_EXPIRATION_BUFFER_SECONDS;
  const sessionExpiresAt = Math.max(reservationExpiresAtSeconds, minimumStripeExpiration);

  return {
    sessionExpiresAt,
    shouldExtendReservation: sessionExpiresAt !== reservationExpiresAtSeconds,
    minimumStripeExpiration,
    reservationExpiresAtSeconds,
    stripeMinimumRequirement: Math.floor(now.getTime() / 1000) + STRIPE_MINIMUM_EXPIRATION_SECONDS
  };
}

export function isEligibleForFamilyFreeShipping(products: ReservedProduct[]) {
  const subtotal = products.reduce((sum, product) => sum + product.price_cents, 0);
  return subtotal <= 2500 && !products.some((product) => product.shipping_class === "sealed");
}

async function releaseReservation(db: CheckoutDb, logger: Logger, reservationId: string, status: "released" | "expired" = "released") {
  const { error } = await db.rpc("release_checkout_inventory", {
    reservation_id: reservationId,
    new_status: status
  });

  if (error) {
    logger.error("Failed to release reservation", { reservationId, status, error: error.message });
  }
}

async function updateReservationExpiry(db: CheckoutDb, reservationId: string, expiresAtSeconds: number) {
  return db
    .from("inventory_reservations")
    .update({ expires_at: new Date(expiresAtSeconds * 1000).toISOString() })
    .eq("id", reservationId);
}

export async function createAtomicCheckoutSession(productIds: unknown, deps: CheckoutDependencies): Promise<CheckoutResult> {
  const normalized = normalizeProductIds(productIds);
  if (!normalized.error) {
    const uniqueRawIds = [...new Set((productIds as unknown[]).filter((id): id is string => typeof id === "string"))];
    if (normalized.ids.length !== uniqueRawIds.length) {
      deps.logger.warn("Checkout request included duplicate or invalid product IDs.");
    }
  } else {
    return { ok: false, status: normalized.status, error: normalized.error };
  }

  const now = deps.now ?? new Date();
  const enteredPromoCode = normalizePromoCode(deps.promoCode);
  const configuredFamilyFreeShippingCode = normalizePromoCode(deps.familyFreeShippingCode);
  let reservationId: string | null = null;

  try {
    const { data: reservationRows, error: reservationError } = await deps.db.rpc("reserve_checkout_inventory", {
      requested_product_ids: normalized.ids
    });

    if (reservationError) {
      const message = reservationError.message || "Checkout failed.";
      const lowered = message.toLowerCase();
      deps.logger.error("Checkout reservation failed", {
        requestedCount: normalized.ids.length,
        error: message
      });

      if (lowered.includes("reserved or sold") || lowered.includes("no longer exist") || lowered.includes("cart is empty")) {
        return { ok: false, status: lowered.includes("cart is empty") ? 400 : 409, error: message };
      }

      return { ok: false, status: 500, error: message };
    }

    const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows;
    if (!reservation) {
      return { ok: false, status: 500, error: "Failed to reserve inventory." };
    }

    reservationId = reservation.reservation_id;
    const reservedProducts = reservation.product_details ?? [];
    const shippingAmount = deps.getShippingAmount(reservedProducts);
    const expiration = computeSessionExpiration(reservation.expires_at, now);
    const isPromotionAttempted = enteredPromoCode.length > 0;
    const hasSealedProduct = reservedProducts.some((product) => product.shipping_class === "sealed");
    const isFamilyFreeShippingEligible = isEligibleForFamilyFreeShipping(reservedProducts);

    if (isPromotionAttempted && !configuredFamilyFreeShippingCode) {
      await releaseReservation(deps.db, deps.logger, reservationId);
      return { ok: false, status: 500, error: "Promo code is unavailable right now." };
    }

    if (isPromotionAttempted && enteredPromoCode !== configuredFamilyFreeShippingCode) {
      await releaseReservation(deps.db, deps.logger, reservationId);
      return { ok: false, status: 400, error: "Promo code is invalid." };
    }

    if (isPromotionAttempted && !isFamilyFreeShippingEligible) {
      await releaseReservation(deps.db, deps.logger, reservationId);
      if (hasSealedProduct) {
        return { ok: false, status: 409, error: "Promo code is not available for sealed products." };
      }

      return { ok: false, status: 409, error: "Promo code is only available for merchandise subtotals of $25 or less." };
    }

    if (expiration.shouldExtendReservation) {
      const { error } = await updateReservationExpiry(deps.db, reservationId, expiration.sessionExpiresAt);
      if (error) {
        deps.logger.error("Failed to extend reservation expiration", {
          reservationId,
          expiresAt: expiration.sessionExpiresAt,
          error: error.message
        });
        await releaseReservation(deps.db, deps.logger, reservationId);
        return { ok: false, status: 500, error: "Checkout failed." };
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      success_url: `${deps.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${deps.baseUrl}/cancel`,
      customer_creation: "always",
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["US"] },
      expires_at: expiration.sessionExpiresAt,
      line_items: reservedProducts.map((product) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: product.price_cents,
          product_data: { name: product.title, metadata: { product_id: product.id } }
        }
      })),
      metadata: {
        reservation_id: reservationId,
        product_ids: normalized.ids.join(","),
        ...(isPromotionAttempted ? { promotion_type: FAMILY_FREE_SHIPPING_PROMOTION_TYPE } : {})
      }
    };

    if (!isPromotionAttempted) {
      sessionParams.shipping_options = [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: shippingAmount, currency: "usd" },
          display_name: deps.getShippingLabel(reservedProducts)
        }
      }];
    }

    let session: { id: string; url: string | null };
    try {
      session = await deps.stripe.checkout.sessions.create(sessionParams);
    } catch (error) {
      deps.logger.error("Stripe Checkout Session creation failed", {
        reservationId,
        itemCount: reservedProducts.length,
        promotionAttempted: isPromotionAttempted,
        reservationExpiresAt: reservation.expires_at,
        sessionExpiresAt: expiration.sessionExpiresAt,
        stripeMinimumRequirement: expiration.stripeMinimumRequirement,
        error: error instanceof Error ? error.message : "Unknown Stripe error"
      });
      await releaseReservation(deps.db, deps.logger, reservationId);
      return { ok: false, status: 500, error: error instanceof Error ? error.message : "Checkout failed." };
    }

    const { error: sessionLinkError } = await deps.db
      .from("inventory_reservations")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", reservationId);

    if (sessionLinkError) {
      deps.logger.error("Failed to attach Stripe session to reservation", {
        reservationId,
        sessionId: session.id,
        error: sessionLinkError.message
      });
    }

    if (!session.url) {
      deps.logger.error("Stripe returned a checkout session without a URL", { reservationId, sessionId: session.id });
      await releaseReservation(deps.db, deps.logger, reservationId);
      return { ok: false, status: 500, error: "Checkout failed." };
    }

    return { ok: true, url: session.url };
  } catch (error) {
    if (reservationId) {
      await releaseReservation(deps.db, deps.logger, reservationId);
    }

    deps.logger.error("Unexpected checkout failure", {
      reservationId,
      error: error instanceof Error ? error.message : "Unknown checkout error"
    });
    return { ok: false, status: 500, error: error instanceof Error ? error.message : "Checkout failed." };
  }
}