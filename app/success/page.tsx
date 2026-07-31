import { createAdminClient } from "@/lib/supabase/admin";
import CheckoutSuccessCartClear from "@/components/CheckoutSuccessCartClear";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SuccessPageProps = {
  searchParams?: Promise<{
    session_id?: string | string[];
  }>;
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function Success({ searchParams }: SuccessPageProps) {
  const resolvedSearchParams: {
    session_id?: string | string[];
  } = await (searchParams ?? Promise.resolve({}));
  const sessionId = Array.isArray(resolvedSearchParams.session_id)
    ? resolvedSearchParams.session_id[0]
    : resolvedSearchParams.session_id ?? null;

  const db = createAdminClient();
  const { data: order } = sessionId
    ? await db.from("orders").select("*").eq("stripe_session_id", sessionId).maybeSingle()
    : { data: null };

  const itemTotal = order?.product_details?.reduce((total: number, item: { price_cents?: number; quantity?: number }) => {
    return total + (item.price_cents ?? 0) * (item.quantity ?? 1);
  }, 0) ?? 0;

  return <main className="container section">
    <CheckoutSuccessCartClear />
    <div className="policy" style={{textAlign:"center", maxWidth: 760, margin: "0 auto"}}>
      <p className="eyebrow">PAYMENT COMPLETE</p>
      <h1>{order?.status === "manual_review" ? "Your order is in review." : "Your order is locked in."}</h1>
      <p>Thanks for buying from me. I’ve saved your shipping details and will send updates by email.</p>
      {order ? (
        <div style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem", textAlign: "left" }}>
          <div className="note">
            <strong>Order summary</strong>
            <p>{Array.isArray(order.product_details) && order.product_details.length > 0 ? order.product_details.map((item: { title?: string }) => item.title).filter(Boolean).join(", ") : "Your items have been recorded."}</p>
            <p>Items: {formatMoney(itemTotal)}</p>
            <p>Shipping: {formatMoney(order.shipping_total ?? 0)}</p>
            <p>Total: {formatMoney(order.amount_total ?? 0)}</p>
          </div>
          <div className="note">
            <strong>Fulfillment</strong>
            <p>Status: {order.fulfillment_status ?? "unfulfilled"}</p>
            {order.shipping_carrier ? <p>Carrier: {order.shipping_carrier}</p> : null}
            {order.tracking_number ? <p>Tracking: {order.tracking_number}</p> : null}
          </div>
          {order.receipt_url ? <a className="btn" href={order.receipt_url} target="_blank" rel="noreferrer">View receipt.</a> : <p>Thank you for your order! A payment receipt has been emailed to the address used at checkout. We’ll send another email with tracking information as soon as your order ships.</p>}
        </div>
      ) : (
        <p>Thank you for your order! A payment receipt has been emailed to the address used at checkout. We’ll send another email with tracking information as soon as your order ships.</p>
      )}
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
        <a className="btn secondary" href="/">Return to My Vault</a>
      </div>
    </div>
  </main>;
}
