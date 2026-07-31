"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";

export default function CheckoutSuccessCartClear() {
  const cart = useCart();

  useEffect(() => {
    cart.clear();
  }, [cart]);

  return null;
}