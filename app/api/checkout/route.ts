import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrderShippingAmount, getOrderShippingLabel } from "@/lib/shipping";

export const runtime = "nodejs";

const TESTJAM_CODE = "TESTJAM";

type ReservedProduct = {
  id: string;
  title: string;
  price_cents: number;
  category: "single" | "slab" | "sealed";
  shipping_class: "card" | "sealed";
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizePromoCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function releaseReservationQuietly(reservationId: string, status: "released" | "expired" = "released") {
  const db = createAdminClient();
  const { error } = await db.rpc("release_checkout_inventory", {
    reservation_id: reservationId,
    new_status: status
  });

  if (error) {
    console.error("Failed to release reservation", { reservationId, status, error: error.message });
  }
}

export async function POST(request: Request) {
  let reservationId: string | null = null;
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) return NextResponse.json({error:"Missing STRIPE_SECRET_KEY."},{status:500});

    const { productIds, promoCode } = await request.json();
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({error:"Cart is empty."},{status:400});
    }

    const normalizedIds = [...new Set(productIds.filter((id): id is string => typeof id === "string" && isUuid(id)))] as string[];
    if (normalizedIds.length === 0) {
      return NextResponse.json({error:"Cart is empty or contains invalid product IDs."},{status:400});
    }

    const uniqueRawIds = [...new Set(productIds.filter((id): id is string => typeof id === "string"))];
    if (normalizedIds.length !== uniqueRawIds.length) {
      console.warn("Checkout request included duplicate or invalid product IDs.");
    }

    const db = createAdminClient();
    const { data: reservationRows, error: reservationError } = await db.rpc("reserve_checkout_inventory", {
      requested_product_ids: normalizedIds
    });

    if (reservationError) {
      const message = reservationError.message || "Checkout failed.";
      const lowered = message.toLowerCase();
      console.error("Checkout reservation failed", {
        requestedCount: normalizedIds.length,
        promoProvided: typeof promoCode === "string" && promoCode.trim().length > 0,
        error: message
      });
      if (lowered.includes("reserved or sold") || lowered.includes("no longer exist") || lowered.includes("cart is empty")) {
        return NextResponse.json({error: message},{status: lowered.includes("cart is empty") ? 400 : 409});
      }
      throw reservationError;
    }

    const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows;
    if (!reservation) {
      throw new Error("Failed to reserve inventory.");
    }

    reservationId = reservation.reservation_id as string;
    const reservedProducts = (reservation.product_details ?? []) as ReservedProduct[];
    const merchandiseSubtotal = reservedProducts.reduce((sum, product) => sum + product.price_cents, 0);
    const shippingAmount = getOrderShippingAmount(reservedProducts);
    const normalizedPromoCode = normalizePromoCode(promoCode);
    let effectiveShippingAmount = shippingAmount;
    let shippingLabel = getOrderShippingLabel(reservedProducts);
    let usePaidShippingOption = true;

    if (normalizedPromoCode) {
      if (normalizedPromoCode !== TESTJAM_CODE) {
        await releaseReservationQuietly(reservationId);
        return NextResponse.json({error: `Promo code ${normalizedPromoCode} is not valid.`},{status:400});
      }

      if (reservedProducts.some((product) => product.shipping_class === "sealed")) {
        await releaseReservationQuietly(reservationId);
        return NextResponse.json({error: "TESTJAM cannot be used when your cart contains sealed products."},{status:409});
      }

      if (merchandiseSubtotal > 2500) {
        await releaseReservationQuietly(reservationId);
        return NextResponse.json({error: `TESTJAM is only valid when your merchandise subtotal is ${formatCurrency(2500)} or less.`},{status:409});
      }

      effectiveShippingAmount = 0;
      shippingLabel = "Free shipping — TESTJAM";
      usePaidShippingOption = false;
    }

    const stripe = new Stripe(stripeSecret);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const sessionExpiresAt = Math.floor(new Date(reservation.expires_at as string).getTime() / 1000);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
      customer_creation: "always",
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["US"] },
      expires_at: sessionExpiresAt,
      line_items: reservedProducts.map((p) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: p.price_cents,
          product_data: { name: p.title, metadata: { product_id: p.id } }
        }
      })),
      metadata: {
        reservation_id: reservationId,
        product_ids: normalizedIds.join(","),
        promo_code: normalizedPromoCode || ""
      }
    };

    if (usePaidShippingOption) {
      sessionParams.shipping_options = [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: effectiveShippingAmount, currency: "usd" },
          display_name: shippingLabel
        }
      }];
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (error) {
      console.error("Stripe Checkout Session creation failed", {
        reservationId,
        promoApplied: normalizedPromoCode === TESTJAM_CODE,
        itemCount: reservedProducts.length,
        shippingAmount: effectiveShippingAmount,
        error: error instanceof Error ? error.message : "Unknown Stripe error"
      });
      throw error;
    }

    const { error: sessionLinkError } = await db
      .from("inventory_reservations")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", reservationId);

    if (sessionLinkError) {
      console.error("Failed to attach Stripe session to reservation:", sessionLinkError);
    }

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({url: session.url});
  } catch (e) {
    if (reservationId) {
      try {
        await releaseReservationQuietly(reservationId);
      } catch (releaseError) {
        console.error("Failed to release inventory after checkout error:", releaseError);
      }
    }

    console.error(e);
    return NextResponse.json({error:e instanceof Error ? e.message : "Checkout failed."},{status:500});
  }
}
