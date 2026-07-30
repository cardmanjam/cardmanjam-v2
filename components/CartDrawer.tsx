"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getOrderShippingAmount } from "@/lib/shipping";
import { useCart } from "./CartProvider";

export default function CartDrawer() {
  const cart = useCart();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const total = cart.items.reduce((s, x) => s + x.price_cents, 0);
  const shipping = getOrderShippingAmount(cart.items);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  async function checkout() {
    if (!cart.items.length) return;
    try {
      setLoading(true);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ productIds: cart.items.map((x) => x.id) })
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Checkout failed.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      alert("Checkout failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(<div className="cart-shell" role="dialog" aria-modal="true" aria-label="Vault cart">
    <button className="cart-backdrop" aria-label="Close cart" onClick={() => cart.setOpen(false)} />
    <aside className="cart-panel">
      <button className="btn secondary" onClick={() => cart.setOpen(false)}>CLOSE</button>
      <h2>Vault Cart</h2>
      {!cart.items.length && <p>Your cart is empty.</p>}
      {cart.items.map(item => <div className="cart-row" key={item.id}>
        <div><strong>{item.title}</strong><div>${(item.price_cents/100).toFixed(2)}</div></div>
        <button className="btn danger" onClick={() => cart.remove(item.id)}>X</button>
      </div>)}
      {!!cart.items.length && <div className="cart-footer">
        <p>Items: <strong>${(total/100).toFixed(2)}</strong></p>
        <p>Shipping: <strong>${(shipping/100).toFixed(2)}</strong></p>
        <p>Tax and discounts are calculated by Stripe at checkout.</p>
        <button className="btn" disabled={loading} onClick={checkout}>
          {loading ? "OPENING STRIPE..." : "SECURE CHECKOUT"}
        </button>
      </div>}
    </aside>
  </div>, document.body);
}
