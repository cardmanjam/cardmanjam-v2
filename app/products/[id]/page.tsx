import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCart from "@/components/AddToCart";
import ProductDetailGallery from "@/components/ProductDetailGallery";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { formatGradingCompanyLabel, resolveProductGradingCompany, resolveProductLanguage, resolveProductGrade, isGradedProduct } from "@/lib/product-metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProduct(id: string): Promise<Product | null> {
  try {
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
  } catch (error) {
    console.error("Product detail Supabase client error:", error);
    return null;
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const imageUrls = (product.image_urls || []).filter((image): image is string => typeof image === "string" && Boolean(image));
  const language = resolveProductLanguage(product) ?? "Other";
  const gradingCompany = resolveProductGradingCompany(product);
  const grade = resolveProductGrade(product);
  const graded = isGradedProduct(product);

  return (
    <main className="container section">
      <Link href="/" className="btn secondary" style={{ marginBottom: "1.5rem" }}>
        ← Back to shop
      </Link>
      <div className="detail-shell">
        <div className="card">
          {product.featured ? <span className="tag" style={{ marginBottom: "0.9rem" }}>JAM'S PICK</span> : null}
          <ProductDetailGallery title={product.title} imageUrls={imageUrls} />
        </div>
        <div className="detail-panel">
          <p className="eyebrow">PREMIUM LISTING</p>
          <h1>{product.title}</h1>
          <p className="price" style={{ fontSize: "24px" }}>${(product.price_cents / 100).toFixed(2)}</p>
          <div className="detail-meta">
            <div><strong>Condition</strong><span>{product.condition || "Review listing photos"}</span></div>
            <div><strong>Card Type</strong><span>{product.category === "slab" ? (graded ? "Graded" : "Ungraded") : product.category === "sealed" ? "Sealed Product" : "Ungraded"}</span></div>
            <div><strong>Language</strong><span>{language}</span></div>
            {graded ? <div><strong>Grading Company</strong><span>{formatGradingCompanyLabel(gradingCompany)}</span></div> : null}
            {graded && grade ? <div><strong>Grade</strong><span>{grade}</span></div> : null}
            <div><strong>Status</strong><span>{product.quantity > 0 ? "In stock" : "Sold out"}</span></div>
            <div><strong>Shipping</strong><span>{product.shipping_class === "sealed" ? "$15 sealed shipping" : "$5 tracked card/slab shipping"}</span></div>
          </div>
          <div className="detail-actions">
            <AddToCart product={product} />
          </div>
          <div className="note">
            <strong>Description</strong>
            <p>{product.description || "A hand-picked piece from the vault."}</p>
          </div>
          <div className="note" style={{ marginTop: "1rem" }}>
            <strong>Why it stands out</strong>
            <p>{product.vault_note || "Hand-picked by Jam for collectors who care about quality."}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
