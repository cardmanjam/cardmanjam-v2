import { notFound } from "next/navigation";
import AdminProductForm from "@/components/AdminProductForm";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

async function getProduct(id: string): Promise<Product | null> {
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("products").select("*").eq("id", id).maybeSingle();

    if (error) {
      console.error("Admin product fetch error:", error);
      return null;
    }

    return data as Product | null;
  } catch (error) {
    console.error("Admin product Supabase client error:", error);
    return null;
  }
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  return <AdminProductForm mode="edit" initialProduct={product} />;
}
