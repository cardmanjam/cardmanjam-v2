import { createAdminClient } from "@/lib/supabase/admin";
export default async function AdminHome() {
  const db = createAdminClient();
  const [{count: active},{count: sold},{count: orders}] = await Promise.all([
    db.from("products").select("*",{count:"exact",head:true}).eq("status","active"),
    db.from("products").select("*",{count:"exact",head:true}).eq("status","sold"),
    db.from("orders").select("*",{count:"exact",head:true})
  ]);
  return <><p className="eyebrow">CONTROL ROOM</p><h1>Vault Dashboard</h1>
    <div className="stat-grid">
      <div className="stat"><b>{active||0}</b>Active Products</div>
      <div className="stat"><b>{sold||0}</b>Sold Products</div>
      <div className="stat"><b>{orders||0}</b>Total Orders</div>
    </div>
  </>;
}
