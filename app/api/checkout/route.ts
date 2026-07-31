import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAtomicCheckoutSession } from "@/lib/checkout/atomic";
import { getOrderShippingAmount, getOrderShippingLabel } from "@/lib/shipping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) return NextResponse.json({error:"Missing STRIPE_SECRET_KEY."},{status:500});

    const { productIds, promoCode } = await request.json();
    const result = await createAtomicCheckoutSession(productIds, {
      db: createAdminClient(),
      stripe: new Stripe(stripeSecret),
      baseUrl: process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin,
      logger: console,
      promoCode,
      familyFreeShippingCode: process.env.FAMILY_FREE_SHIPPING_CODE,
      getShippingAmount: getOrderShippingAmount,
      getShippingLabel: getOrderShippingLabel
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({url: result.url});
  } catch (e) {
    console.error(e);
    return NextResponse.json({error:e instanceof Error ? e.message : "Checkout failed."},{status:500});
  }
}
