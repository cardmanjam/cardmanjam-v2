"use client";
import { useCart } from "./CartProvider";
import CartDrawer from "./CartDrawer";

export default function CartButton() {
  const cart = useCart();
  return <>
    <button className="btn" onClick={() => cart.setOpen(true)}>CART ({cart.items.length})</button>
    {cart.open && <CartDrawer />}
  </>;
}
