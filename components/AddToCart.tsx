"use client";
import type { Product } from "@/lib/types";
import { useCart } from "./CartProvider";

export default function AddToCart({ product }: { product: Product }) {
  const cart = useCart();
  return <button className="btn" onClick={() => cart.add({
    id: product.id,
    title: product.title,
    price_cents: product.price_cents,
    category: product.category,
    shipping_class: product.shipping_class,
    image_url: product.image_urls?.[0]
  })}>ADD TO CART</button>;
}
