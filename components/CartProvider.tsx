"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/types";

type CartContextType = {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cmj-cart-v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((item): item is CartItem => typeof item?.id === "string" && typeof item?.title === "string" && typeof item?.price_cents === "number" && (item?.shipping_class === "card" || item?.shipping_class === "sealed") && (item?.category === "single" || item?.category === "slab" || item?.category === "sealed")));
        }
      }
    } catch {
      localStorage.removeItem("cmj-cart-v2");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("cmj-cart-v2", JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo(() => ({
    items,
    open,
    setOpen,
    add(item: CartItem) {
      setItems((prev) => prev.some((p) => p.id === item.id) ? prev : [...prev, item]);
      setOpen(true);
    },
    remove(id: string) { setItems((prev) => prev.filter((p) => p.id !== id)); },
    clear() { setItems([]); }
  }), [items, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
