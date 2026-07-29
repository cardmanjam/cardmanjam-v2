"use client";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import AddToCart from "./AddToCart";

export default function ProductGrid({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState("all");
  const shown = useMemo(() => products.filter((product) => filter === "all" || product.category === filter), [filter, products]);

  return <>
    <div className="filters">
      {["all", "single", "slab", "sealed"].map((x) =>
        <button key={x} className={`filter ${filter === x ? "active" : ""}`} onClick={() => setFilter(x)}>{x.toUpperCase()}</button>
      )}
    </div>
    {shown.length === 0 ? (
      <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
        <h3>No active products right now</h3>
        <p>New inventory is being added regularly. Check back soon for fresh vault drops.</p>
      </div>
    ) : (
      <div className="grid">
        {shown.map((product) => <article className="card" key={product.id}>
          {product.featured && <span className="tag">JAM&apos;S PICK</span>}
          {product.image_urls?.[0]
            ? <img className="card-image" src={product.image_urls[0]} alt={product.title}/>
            : <div className="placeholder">JC</div>}
          <h3>{product.title}</h3>
          <p className="price">${(product.price_cents / 100).toFixed(2)}</p>
          <p>{product.condition || "Review listing photos"}</p>
          <p>{product.description || "A hand-picked piece from the vault."}</p>
          <p className="note"><strong>Why it&apos;s in the Vault:</strong><br/>{product.vault_note || "Hand-picked by Card Man Jam."}</p>
          <AddToCart product={product}/>
        </article>)}
      </div>
    )}
  </>;
}
