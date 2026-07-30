import ProductGrid from "@/components/ProductGrid";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProducts(): Promise<Product[]> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("status", "active")
      .gt("quantity", 0)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Product[];
  } catch {
    return [];
  }
}

export default async function Home() {
  const products = await getProducts();
  return <main>
    <section className="container hero">
      <div>
        <p className="eyebrow">THE VAULT IS OPEN</p>
        <h1>Small Drops.<br/><span>Big Finds.</span></h1>
        <p>No giant marketplace. Just cards personally picked, photographed, priced and added by Card Man Jam.</p>
        <a className="btn" href="#shop">ENTER THE VAULT</a>
      </div>
      <div className="vault-box">VAULT<br/>DROP</div>
    </section>
    <section id="shop" className="container section">
      <div className="section-head">
        <p className="eyebrow">HAND-PICKED INVENTORY</p>
        <h2>Recently Added</h2>
        <p>Most products are one-copy listings. Once they sell, they are gone.</p>
      </div>
      <ProductGrid products={products}/>
    </section>
  </main>;
}
