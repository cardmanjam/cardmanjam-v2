import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const ids = session.metadata?.product_ids?.split(",").filter(Boolean) || [];
    const db = createAdminClient();

    const { data: existing } = await db.from("orders").select("id").eq("stripe_session_id", session.id).maybeSingle();
    if (!existing) {
      await db.from("orders").insert({
        stripe_session_id: session.id,
        stripe_payment_intent_id: String(session.payment_intent || ""),
        customer_email: session.customer_details?.email,
        customer_name: session.customer_details?.name,
        shipping_address: session.shipping_details?.address || null,
        amount_total: session.amount_total || 0,
        shipping_total: session.total_details?.amount_shipping || 0,
        status: "paid",
        product_ids: ids
      });

      for (const id of ids) {
        await db.from("products").update({status:"sold",quantity:0}).eq("id",id).eq("status","active");
      }
    }
  }
  return NextResponse.json({received:true});
}
