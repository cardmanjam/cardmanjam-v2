import { createAdminClient } from "@/lib/supabase/admin";
export default async function Products() {
  const db=createAdminClient();
  const {data}=await db.from("products").select("id,title,price_cents,status,quantity,category,created_at").order("created_at",{ascending:false});
  return <><p className="eyebrow">INVENTORY</p><h1>Products</h1><a className="btn" href="/admin/products/new">+ ADD PRODUCT</a><br/><br/>
    <div style={{overflowX:"auto"}}><table><thead><tr><th>Product</th><th>Price</th><th>Type</th><th>Qty</th><th>Status</th></tr></thead>
    <tbody>{data?.map(p=><tr key={p.id}><td>{p.title}</td><td>${(p.price_cents/100).toFixed(2)}</td><td>{p.category}</td><td>{p.quantity}</td><td className="status">{p.status}</td></tr>)}</tbody></table></div>
  </>;
}
