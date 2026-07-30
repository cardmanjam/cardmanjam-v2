"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeGradingCompanyValue, normalizeLanguageValue } from "@/lib/product-metadata";
import { resolveShippingClass } from "@/lib/shipping";

function slugify(s:string){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");}

function parseImageUrls(formData:FormData, image_urls:string[] = []) {
  const readUrls = (rawValue: FormDataEntryValue | null) => {
    const raw = String(rawValue || "[]");
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === "string" && Boolean(url)) : [];
    } catch {
      return [];
    }
  };

  const existing = readUrls(formData.get("existing_image_urls"));
  const uploaded = image_urls.length > 0 ? image_urls.filter(Boolean) : readUrls(formData.get("image_urls"));
  return [...existing, ...uploaded];
}

export async function canUploadProductImages() {
  await requireAdmin();
  return true;
}

export async function createProduct(formData:FormData, image_urls:string[] = []) {
  await requireAdmin();
  const db = createAdminClient();
  const title = String(formData.get("title") || "");
  const urls = parseImageUrls(formData, image_urls);
  const category = String(formData.get("category") || "single");
  const shippingClass = resolveShippingClass(category === "sealed" ? "sealed" : category === "slab" ? "slab" : "single");
  const language = normalizeLanguageValue(String(formData.get("language") || ""));
  const gradingCompany = category === "slab" ? normalizeGradingCompanyValue(String(formData.get("grading_company") || "")) : null;
  const grade = category === "slab" ? String(formData.get("grade") || "").trim() : null;

  if (!title.trim()) throw new Error("Title is required.");
  if (!language) throw new Error("Language is required.");
  if (category === "slab" && (!gradingCompany || !grade)) {
    throw new Error("Graded cards require both grading company and grade.");
  }

  const {error} = await db.from("products").insert({
    title,
    slug: `${slugify(title)}-${Date.now().toString().slice(-6)}`,
    description: String(formData.get("description") || ""),
    vault_note: String(formData.get("vault_note") || ""),
    condition: String(formData.get("condition") || ""),
    category,
    shipping_class: shippingClass,
    price_cents: Math.round(Number(formData.get("price")) * 100),
    quantity: Number(formData.get("quantity") || 1),
    status: formData.get("publish_immediately") === "on" ? "active" : "draft",
    featured: formData.get("featured") === "on",
    language,
    grading_company: gradingCompany,
    grade,
    image_urls: urls
  });
  if (error) throw error;
  redirect("/admin/products");
}

export async function updateProduct(formData:FormData, image_urls:string[] = []) {
  await requireAdmin();
  const db = createAdminClient();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "");
  const urls = parseImageUrls(formData, image_urls);
  const category = String(formData.get("category") || "single");
  const shippingClass = resolveShippingClass(category === "sealed" ? "sealed" : category === "slab" ? "slab" : "single");
  const language = normalizeLanguageValue(String(formData.get("language") || ""));
  const gradingCompany = category === "slab" ? normalizeGradingCompanyValue(String(formData.get("grading_company") || "")) : null;
  const grade = category === "slab" ? String(formData.get("grade") || "").trim() : null;

  if (!id) throw new Error("Missing product ID.");
  if (!title.trim()) throw new Error("Title is required.");
  if (!language) throw new Error("Language is required.");
  if (category === "slab" && (!gradingCompany || !grade)) {
    throw new Error("Graded cards require both grading company and grade.");
  }

  const { error } = await db
    .from("products")
    .update({
      title,
      description: String(formData.get("description") || ""),
      vault_note: String(formData.get("vault_note") || ""),
      condition: String(formData.get("condition") || ""),
      category,
      shipping_class: shippingClass,
      price_cents: Math.round(Number(formData.get("price")) * 100),
      quantity: Number(formData.get("quantity") || 1),
      status: formData.get("publish_immediately") === "on" ? "active" : "draft",
      featured: formData.get("featured") === "on",
      language,
      grading_company: gradingCompany,
      grade,
      image_urls: urls
    })
    .eq("id", id);

  if (error) throw error;
  redirect("/admin/products");
}
