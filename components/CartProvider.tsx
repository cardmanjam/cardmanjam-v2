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

  useEffect(() => {
    const saved = localStorage.getItem("cmj-cart-v2");
    if (saved) setItems(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("cmj-cart-v2", JSON.stringify(items));
  }, [items]);

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
