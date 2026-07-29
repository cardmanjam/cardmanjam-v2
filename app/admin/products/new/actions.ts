"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function slugify(s:string){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");}

export async function createProduct(formData:FormData) {
  await requireAdmin();
  const db = createAdminClient();
  const title = String(formData.get("title") || "");
  const files = formData.getAll("images").filter(x => x instanceof File && x.size > 0) as File[];
  const urls:string[] = [];

  for (const file of files.slice(0,6)) {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"")}`;
    const {error} = await db.storage.from("product-images").upload(safe, file, {contentType:file.type});
    if (error) throw error;
    const {data} = db.storage.from("product-images").getPublicUrl(safe);
    urls.push(data.publicUrl);
  }

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
    status: formData.get("publish") === "on" ? "active" : "draft",
    featured: formData.get("featured") === "on",
    image_urls: urls
  });
  if (error) throw error;
  redirect("/admin/products");
}
