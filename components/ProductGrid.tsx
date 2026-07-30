"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import AddToCart from "./AddToCart";
import { formatGradingCompanyLabel, resolveProductGradingCompany, resolveProductLanguage, resolveProductGrade } from "@/lib/product-metadata";

function normalizeCategory(value: string) {
  if (value === "single") return "single";
  if (value === "slab") return "slab";
  if (value === "sealed") return "sealed";
  return "single";
}

function getLanguageLabel(value: string | null | undefined) {
  return resolveProductLanguage({ language: value ?? null, title: "", condition: null }) ?? "Other";
}

function getGradingCompany(product: Product) {
  return resolveProductGradingCompany(product);
}

export default function ProductGrid({ products }: { products: Product[] }) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [languageFilters, setLanguageFilters] = useState<string[]>([]);
  const [companyFilters, setCompanyFilters] = useState<string[]>([]);

  const shown = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch = categoryFilter === "all" || normalizeCategory(product.category) === categoryFilter;
      const languageMatch = languageFilters.length === 0 || languageFilters.includes(getLanguageLabel(product.language));
      const gradingCompany = getGradingCompany(product);
      const companyMatch = companyFilters.length === 0 || (product.category === "slab" && gradingCompany !== null && companyFilters.includes(gradingCompany));
      return categoryMatch && languageMatch && companyMatch;
    });
  }, [categoryFilter, languageFilters, companyFilters, products]);

  const isRecentlyAdded = (createdAt: string) => {
    const timestamp = new Date(createdAt).getTime();
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  };

  const toggleLanguage = (value: string) => {
    setLanguageFilters((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const toggleCompany = (value: string) => {
    setCompanyFilters((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const clearFilters = () => {
    setCategoryFilter("all");
    setLanguageFilters([]);
    setCompanyFilters([]);
  };

  const hasActiveFilters = categoryFilter !== "all" || languageFilters.length > 0 || companyFilters.length > 0;

  return <>
    <div className="filters">
      {(["all", "single", "slab", "sealed"] as const).map((value) =>
        <button key={value} className={`filter ${categoryFilter === value ? "active" : ""}`} onClick={() => setCategoryFilter(value)}>{value === "all" ? "All" : value === "single" ? "Singles" : value === "slab" ? "Graded Slabs" : "Sealed"}</button>
      )}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem" }}>
      <span className="eyebrow">{shown.length} cards in My Vault</span>
      {hasActiveFilters ? <button className="btn secondary" onClick={clearFilters} type="button">Clear Filters</button> : null}
    </div>
    {categoryFilter === "single" ? <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {(["English", "Japanese", "Korean", "Chinese", "Other"] as const).map((language) => <button key={language} type="button" className={`filter ${languageFilters.includes(language) ? "active" : ""}`} onClick={() => toggleLanguage(language)}>{language}</button>)}
    </div> : null}
    {categoryFilter === "slab" ? <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {(["PSA", "CGC", "BGS"] as const).map((company) => <button key={company} type="button" className={`filter ${companyFilters.includes(company) ? "active" : ""}`} onClick={() => toggleCompany(company)}>{company === "BGS" ? "Beckett (BGS)" : company}</button>)}
    </div> : null}
    {shown.length === 0 ? (
      <div className="empty-state">
        <h3>I'm out hunting for the next card worth adding.</h3>
        <p>Follow me on Instagram to see pickups before they land in My Vault.</p>
        <div className="hero-actions">
          <a className="btn secondary" href="https://www.instagram.com/cardmanjam" target="_blank" rel="noreferrer">Follow on Instagram</a>
          <a className="btn" href="https://x.com/cardmanjam" target="_blank" rel="noreferrer">Follow on X</a>
        </div>
      </div>
    ) : (
      <div className="grid">
        {shown.map((product) => <article className="product-card" key={product.id}>
          {product.featured || isRecentlyAdded(product.created_at) ? <span className="tag">{product.featured ? "JAM'S PICK" : "RECENTLY ADDED"}</span> : null}
          <Link className="product-card-link" href={`/products/${product.id}`}>
            {product.image_urls?.[0]
              ? <img className="card-image" src={product.image_urls[0]} alt={product.title} />
              : <div className="placeholder">JC</div>}
            <div>
              <h3>{product.title}</h3>
              <p className="price">${(product.price_cents / 100).toFixed(2)}</p>
              <p>{product.condition || "Review listing photos"}</p>
              {product.category === "slab" ? <p style={{ color: "#a8b7cd" }}>{getGradingCompany(product) ? `${formatGradingCompanyLabel(getGradingCompany(product))}${resolveProductGrade(product) ? ` • ${resolveProductGrade(product)}` : ""}` : "Review listing photos"}</p> : null}
            </div>
          </Link>
          <div className="product-card-footer">
            <p className="eyebrow" style={{ margin: 0 }}>Ready to ship</p>
            <AddToCart product={product} />
          </div>
        </article>)}
      </div>
    )}
  </>;
}
