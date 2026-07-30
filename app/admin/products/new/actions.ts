"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function slugify(s:string){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");}

function parseImageUrls(formData:FormData, image_urls:string[] = []) {
  if (image_urls.length > 0) return image_urls.filter(Boolean);
  const raw = String(formData.get("image_urls") || "[]");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === "string" && Boolean(url)) : [];
  } catch {
    return [];
  }
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

  const {error} = await db.from("products").insert({
    title,
    slug: `${slugify(title)}-${Date.now().toString().slice(-6)}`,
    description: String(formData.get("description") || ""),
    vault_note: String(formData.get("vault_note") || ""),
    condition: String(formData.get("condition") || ""),
    category: String(formData.get("category")),
    shipping_class: String(formData.get("shipping_class")),
    price_cents: Math.round(Number(formData.get("price")) * 100),
    quantity: Number(formData.get("quantity") || 1),
    status: formData.get("publish_immediately") === "on" ? "active" : "draft",
    featured: formData.get("featured") === "on",
    language: String(formData.get("language") || ""),
    grading_company: String(formData.get("grading_company") || ""),
    grade: String(formData.get("grade") || ""),
    image_urls: urls
  });
  if (error) throw error;
  redirect("/admin/products");
}
