import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ProductSnapshot = {
  id: string;
  title: string;
  price_cents: number;
  category: "single" | "slab" | "sealed";
  shipping_class: "card" | "sealed";
};

async function getFullSession(stripe: Stripe, sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "payment_intent.latest_charge"]
  });
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
}

function getReceiptUrl(paymentIntent: Stripe.PaymentIntent | Stripe.Response<Stripe.PaymentIntent> | null) {
  if (!paymentIntent || typeof paymentIntent === "string") return null;
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === "string") return null;
  return latestCharge.receipt_url ?? null;
}

function getShippingAddress(session: Stripe.Checkout.Session) {
  const checkoutSession = session as Stripe.Checkout.Session & {
    shipping_details?: { address?: Record<string, string | null> | null; name?: string | null };
    customer_details?: { address?: Record<string, string | null> | null; name?: string | null; email?: string | null };
  };

  return checkoutSession.shipping_details?.address ?? checkoutSession.customer_details?.address ?? null;
}

function getCustomerName(session: Stripe.Checkout.Session) {
  const checkoutSession = session as Stripe.Checkout.Session & {
    shipping_details?: { address?: Record<string, string | null> | null; name?: string | null };
    customer_details?: { address?: Record<string, string | null> | null; name?: string | null; email?: string | null };
  };

  return checkoutSession.shipping_details?.name ?? checkoutSession.customer_details?.name ?? null;
}

function parseProductIds(session: Stripe.Checkout.Session) {
  return [...new Set(String(session.metadata?.product_ids ?? "").split(",").map((id) => id.trim()).filter(Boolean))];
}

async function buildProductDetails(db: ReturnType<typeof createAdminClient>, productIds: string[]) {
  if (!productIds.length) return [] as ProductSnapshot[];

  const { data } = await db
    .from("products")
    .select("id,title,price_cents,category,shipping_class")
    .in("id", productIds);

  return (data ?? []) as ProductSnapshot[];
}

function attachPromoMetadata(productDetails: ProductSnapshot[], promoCode: string | null) {
  if (!promoCode) return productDetails;

  return [...productDetails, { id: `promo-${promoCode}`, title: `Promo code ${promoCode}` } as ProductSnapshot];
}

async function finalizePaidSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const db = createAdminClient();
  const productIds = parseProductIds(session);
  const paymentIntentId = getPaymentIntentId(session);
  const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
  const customerName = getCustomerName(session);
  const shippingAddress = getShippingAddress(session);

  if (!paymentIntentId) {
    throw new Error("Missing payment intent on completed Stripe session.");
  }

  if (customerEmail) {
    await stripe.paymentIntents.update(
      paymentIntentId,
      { receipt_email: customerEmail },
      { idempotencyKey: `receipt-${session.id}` }
    );
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"]
  });

  const receiptUrl = getReceiptUrl(paymentIntent);
  const productDetails = attachPromoMetadata(await buildProductDetails(db, productIds), session.metadata?.promo_code ?? null);
  const reservationId = session.metadata?.reservation_id || null;
  const amountTotal = session.amount_total ?? 0;
  const shippingTotal = session.total_details?.amount_shipping ?? 0;

  if (reservationId) {
    const { error } = await db.rpc("finalize_reserved_checkout", {
      reservation_id: reservationId,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      customer_email: customerEmail,
      customer_name: customerName,
      shipping_address: shippingAddress,
      amount_total: amountTotal,
      shipping_total: shippingTotal,
      receipt_url: receiptUrl,
      product_details: productDetails,
      product_ids: productIds
    });

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await db.rpc("finalize_legacy_checkout", {
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    customer_email: customerEmail,
    customer_name: customerName,
    shipping_address: shippingAddress,
    amount_total: amountTotal,
    shipping_total: shippingTotal,
    receipt_url: receiptUrl,
    product_details: productDetails,
    product_ids: productIds
  });

  if (error) {
    throw error;
  }
}

async function releaseExpiredSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const reservationId = session.metadata?.reservation_id;
  if (!reservationId) return;

  const liveSession = await getFullSession(stripe, session.id);
  if (liveSession.status !== "expired") {
    return;
  }

  const db = createAdminClient();
  const { error } = await db.rpc("release_checkout_inventory", {
    reservation_id: reservationId,
    new_status: "expired"
  });

  if (error) {
    throw error;
  }
}

export async function POST(request: Request) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret || !webhookSecret) return new NextResponse("Missing webhook configuration", {status:500});

  const stripe = new Stripe(stripeSecret);
  const signature = (await headers()).get("stripe-signature");
  if (!signature) return new NextResponse("Missing Stripe signature", {status:400});

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return new NextResponse("Invalid webhook signature", {status:400});
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const liveSession = await getFullSession(stripe, session.id);

    if (liveSession.payment_status !== "paid" && liveSession.status !== "complete") {
      return NextResponse.json({received:true});
    }

    if (!liveSession.customer_details?.email && !liveSession.customer_email) {
      throw new Error("Stripe session is missing a buyer email.");
    }

    await finalizePaidSession(stripe, liveSession);
    return NextResponse.json({received:true});
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    await releaseExpiredSession(stripe, session);
    return NextResponse.json({received:true});
  }
  return NextResponse.json({received:true});
}
