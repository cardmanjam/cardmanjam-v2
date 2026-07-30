"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import AddToCart from "./AddToCart";

function normalizeCategory(value: string) {
  if (value === "single") return "single";
  if (value === "slab") return "slab";
  if (value === "sealed") return "sealed";
  return "single";
}

function getLanguageLabel(value: string | null | undefined) {
  if (!value) return "Other";
  const normalized = value.toLowerCase();
  if (normalized === "english") return "English";
  if (normalized === "japanese") return "Japanese";
  return "Other";
}

function getGradingCompany(product: Product) {
  if (product.grading_company) return product.grading_company;
  if (product.category === "slab" && /psa/i.test(product.title)) return "PSA";
  if (product.category === "slab" && /cgc/i.test(product.title)) return "CGC";
  return null;
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
      const companyMatch = companyFilters.length === 0 || (product.category === "slab" && (!gradingCompany || companyFilters.includes(gradingCompany)));
      return categoryMatch && languageMatch && companyMatch;
    });
  }, [categoryFilter, languageFilters, companyFilters, products]);

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
    <div className="filters" style={{ justifyContent: "flex-start", margin: "0 0 18px" }}>
      {(["all", "single", "slab", "sealed"] as const).map((value) =>
        <button key={value} className={`filter ${categoryFilter === value ? "active" : ""}`} onClick={() => setCategoryFilter(value)}>{value === "all" ? "All" : value === "single" ? "Singles" : value === "slab" ? "Graded Slabs" : "Sealed"}</button>
      )}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem" }}>
      <span className="eyebrow">{shown.length} items</span>
      {hasActiveFilters ? <button className="btn secondary" onClick={clearFilters} type="button">Clear Filters</button> : null}
    </div>
    {categoryFilter === "single" ? <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {(["English", "Japanese", "Other"] as const).map((language) => <button key={language} type="button" className={`filter ${languageFilters.includes(language) ? "active" : ""}`} onClick={() => toggleLanguage(language)}>{language}</button>)}
    </div> : null}
    {categoryFilter === "slab" ? <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      {(["PSA", "CGC"] as const).map((company) => <button key={company} type="button" className={`filter ${companyFilters.includes(company) ? "active" : ""}`} onClick={() => toggleCompany(company)}>{company}</button>)}
    </div> : null}
    {shown.length === 0 ? (
      <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
        <h3>No active products right now</h3>
        <p>New inventory is being added regularly. Check back soon for fresh vault drops.</p>
      </div>
    ) : (
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {shown.map((product) => <article className="card" key={product.id} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {product.featured ? <span className="tag">JAM&apos;S PICK</span> : null}
          <Link href={`/products/${product.id}`}>
            {product.image_urls?.[0]
              ? <img className="card-image" src={product.image_urls[0]} alt={product.title} style={{ height: "220px" }} />
              : <div className="placeholder" style={{ height: "220px" }}>JC</div>}
          </Link>
          <div>
            <Link href={`/products/${product.id}`} style={{ textDecoration: "none" }}><h3 style={{ margin: "0 0 0.35rem" }}>{product.title}</h3></Link>
            <p className="price">${(product.price_cents / 100).toFixed(2)}</p>
            <p style={{ margin: "0.25rem 0" }}>{product.condition || "Review listing photos"}</p>
            {product.category === "slab" ? <p style={{ margin: "0.25rem 0", color: "#a9b9d6" }}>{getGradingCompany(product) ? `${getGradingCompany(product)}${product.grade ? ` • ${product.grade}` : ""}` : "Ungraded or review"}</p> : null}
          </div>
          <AddToCart product={product}/>
        </article>)}
      </div>
    )}
  </>;
}
