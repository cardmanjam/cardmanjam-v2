import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) return NextResponse.json({error:"Missing STRIPE_SECRET_KEY."},{status:500});

    const { productIds } = await request.json();
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({error:"Cart is empty."},{status:400});
    }

    const uniqueIds = [...new Set(productIds)] as string[];
    const db = createAdminClient();
    const { data: products, error } = await db
      .from("products")
      .select("id,title,price_cents,quantity,status,shipping_class")
      .in("id", uniqueIds);

    if (error) throw error;
    if (!products || products.length !== uniqueIds.length) {
      return NextResponse.json({error:"One or more products no longer exist."},{status:409});
    }

    const unavailable = products.find(p => p.status !== "active" || p.quantity < 1);
    if (unavailable) return NextResponse.json({error:`${unavailable.title} is no longer available.`},{status:409});

    const hasSealed = products.some(p => p.shipping_class === "sealed");
    const shippingAmount = hasSealed ? 1500 : 500;
    const stripe = new Stripe(stripeSecret);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
      customer_creation: "always",
      shipping_address_collection: { allowed_countries: ["US"] },
      line_items: products.map(p => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: p.price_cents,
          product_data: { name: p.title, metadata: { product_id: p.id } }
        }
      })),
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: shippingAmount, currency: "usd" },
          display_name: hasSealed ? "Sealed or mixed-order shipping" : "Tracked card/slab shipping"
        }
      }],
      metadata: { product_ids: uniqueIds.join(",") }
    });

    return NextResponse.json({url: session.url});
  } catch (e) {
    console.error(e);
    return NextResponse.json({error:e instanceof Error ? e.message : "Checkout failed."},{status:500});
  }
}
