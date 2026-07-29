import { createAdminClient } from "@/lib/supabase/admin";
export default async function Orders() {
  const db=createAdminClient();
  const {data}=await db.from("orders").select("*").order("created_at",{ascending:false});
  return <><p className="eyebrow">FULFILLMENT</p><h1>Orders</h1>
    <div style={{overflowX:"auto"}}><table><thead><tr><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Stripe Session</th></tr></thead>
    <tbody>{data?.map(o=><tr key={o.id}><td>{new Date(o.created_at).toLocaleDateString()}</td><td>{o.customer_email||"—"}</td><td>${(o.amount_total/100).toFixed(2)}</td><td className="status">{o.status}</td><td>{o.stripe_session_id.slice(0,18)}…</td></tr>)}</tbody></table></div>
  </>;
}
