import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCart from "@/components/AddToCart";
import ProductDetailGallery from "@/components/ProductDetailGallery";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .gt("quantity", 0)
    .maybeSingle();

  if (error) {
    console.error("Product detail fetch error:", error);
    return null;
  }

  return data as Product | null;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const imageUrls = (product.image_urls || []).filter((image): image is string => typeof image === "string" && Boolean(image));
  const language = product.language || "Other";
  const gradingCompany = product.grading_company || (product.category === "slab" ? "Ungraded" : null);

  return (
    <main className="container section">
      <Link href="/" className="btn secondary" style={{ marginBottom: "1.5rem" }}>
        ← Back to shop
      </Link>
      <div className="card" style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "1.1fr 0.9fr" }}>
        <div>
          {product.featured ? <span className="tag">JAM'S PICK</span> : null}
          <ProductDetailGallery title={product.title} imageUrls={imageUrls} />
        </div>
        <div>
          <p className="eyebrow">VAULT LISTING</p>
          <h1 style={{ marginTop: 0 }}>{product.title}</h1>
          <p className="price" style={{ fontSize: "24px" }}>${(product.price_cents / 100).toFixed(2)}</p>
          <p><strong>Condition:</strong> {product.condition || "Review listing photos"}</p>
          <p><strong>Category:</strong> {product.category}</p>
          <p><strong>Language:</strong> {language}</p>
          {product.category === "slab" ? <p><strong>Grading:</strong> {gradingCompany}{product.grade ? ` — ${product.grade}` : ""}</p> : null}
          <p><strong>Status:</strong> {product.quantity > 0 ? "In stock" : "Sold out"}</p>
          <p><strong>Shipping:</strong> {product.shipping_class === "sealed" ? "$15 sealed shipping" : "$5 tracked card/slab shipping"}</p>
          <div style={{ margin: "1.25rem 0" }}>
            <AddToCart product={product} />
          </div>
          <div className="note">
            <strong>Description</strong>
            <p>{product.description || "A hand-picked piece from the vault."}</p>
          </div>
          <div className="note" style={{ marginTop: "1rem" }}>
            <strong>Why It&apos;s in the Vault</strong>
            <p>{product.vault_note || "Hand-picked by Card Man Jam."}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
