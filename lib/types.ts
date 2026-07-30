export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  vault_note: string | null;
  condition: string | null;
  category: "single" | "slab" | "sealed";
  shipping_class: "card" | "sealed";
  price_cents: number;
  quantity: number;
  status: "draft" | "active" | "reserved" | "sold";
  image_urls: string[];
  featured: boolean;
  language: string | null;
  grading_company: string | null;
  grade: string | null;
  created_at: string;
};

export type CartItem = {
  id: string;
  title: string;
  price_cents: number;
  category: Product["category"];
  shipping_class: Product["shipping_class"];
  image_url?: string;
};
