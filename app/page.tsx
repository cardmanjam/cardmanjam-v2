import ProductGrid from "@/components/ProductGrid";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

const demo: Product[] = [
  {id:"demo-1",slug:"demo-slab",title:"Example Vintage Holo Slab",description:null,vault_note:"A clean vintage showcase piece with strong shelf presence.",condition:"Graded slab",category:"slab",shipping_class:"card",price_cents:7500,quantity:1,status:"active",image_urls:[],featured:true,created_at:new Date().toISOString()},
  {id:"demo-2",slug:"demo-single",title:"Example Cosmos Holo Single",description:null,vault_note:"The artwork and holo pattern look better in person.",condition:"Raw card — review photos",category:"single",shipping_class:"card",price_cents:1800,quantity:1,status:"active",image_urls:[],featured:false,created_at:new Date().toISOString()},
  {id:"demo-3",slug:"demo-sealed",title:"Example Sealed Collection Box",description:null,vault_note:"A display-worthy sealed product selected for the vault.",condition:"Factory sealed",category:"sealed",shipping_class:"sealed",price_cents:11000,quantity:1,status:"active",image_urls:[],featured:false,created_at:new Date().toISOString()}
];

async function getProducts(): Promise<Product[]> {
  try {
    if (!process.env.SUPABASE_SECRET_KEY) return demo;
    const db = createAdminClient();
    const { data, error } = await db.from("products").select("*").eq("status","active").gt("quantity",0).order("created_at",{ascending:false});
    if (error) throw error;
    return (data || []) as Product[];
  } catch {
    return demo;
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
