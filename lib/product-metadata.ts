import type { Product } from "@/lib/types";

export const LANGUAGE_OPTIONS = ["English", "Japanese", "Korean", "Chinese", "Other"] as const;
export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

export const GRADING_COMPANY_OPTIONS = ["PSA", "CGC", "BGS"] as const;
export type GradingCompanyOption = (typeof GRADING_COMPANY_OPTIONS)[number];

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeLanguageValue(value: string | null | undefined): LanguageOption | null {
  switch (normalizeText(value)) {
    case "english":
    case "en":
      return "English";
    case "japanese":
    case "jp":
    case "jpn":
      return "Japanese";
    case "korean":
    case "kr":
    case "kor":
      return "Korean";
    case "chinese":
    case "cn":
    case "zh":
      return "Chinese";
    case "other":
      return "Other";
    default:
      return null;
  }
}

export function normalizeGradingCompanyValue(value: string | null | undefined): GradingCompanyOption | null {
  switch (normalizeText(value)) {
    case "psa":
      return "PSA";
    case "cgc":
      return "CGC";
    case "bgs":
    case "beckett":
      return "BGS";
    default:
      return null;
  }
}

export function formatGradingCompanyLabel(value: GradingCompanyOption | null) {
  if (!value) return null;
  return value === "BGS" ? "Beckett (BGS)" : value;
}

export function resolveProductLanguage(product: Pick<Product, "language" | "title" | "condition">) {
  const storedLanguage = normalizeLanguageValue(product.language);
  if (storedLanguage) return storedLanguage;

  const sourceText = `${product.title} ${product.condition ?? ""}`;
  if (/japanese|\bjp\b|\bjpn\b/i.test(sourceText)) return "Japanese";
  if (/korean|\bkr\b|\bkor\b/i.test(sourceText)) return "Korean";
  if (/chinese|\bcn\b|\bzh\b/i.test(sourceText)) return "Chinese";
  if (/english|\ben\b/i.test(sourceText)) return "English";
  return null;
}

export function resolveProductGradingCompany(product: Pick<Product, "grading_company" | "title" | "condition">) {
  const storedCompany = normalizeGradingCompanyValue(product.grading_company);
  if (storedCompany) return storedCompany;

  const sourceText = `${product.title} ${product.condition ?? ""}`;
  if (/beckett|\bbgs\b/i.test(sourceText)) return "BGS";
  if (/\bpsa\b/i.test(sourceText)) return "PSA";
  if (/\bcgc\b/i.test(sourceText)) return "CGC";
  return null;
}

export function resolveProductGrade(product: Pick<Product, "grade">) {
  const grade = product.grade?.trim();
  return grade ? grade : null;
}

export function isGradedProduct(product: Pick<Product, "category" | "grading_company" | "title" | "condition">) {
  return product.category === "slab" && resolveProductGradingCompany(product) !== null;
}
