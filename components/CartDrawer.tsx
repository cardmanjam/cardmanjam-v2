"use client";
import { useState } from "react";
import { useCart } from "./CartProvider";

export default function CartDrawer() {
  const cart = useCart();
  const [loading, setLoading] = useState(false);
  const total = cart.items.reduce((s, x) => s + x.price_cents, 0);
  const hasSealed = cart.items.some((x) => x.shipping_class === "sealed");
  const shipping = hasSealed ? 1500 : 500;

  async function checkout() {
    if (!cart.items.length) return;
    setLoading(true);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ productIds: cart.items.map((x) => x.id) })
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Checkout failed.");
      setLoading(false);
      return;
    }
    window.location.href = data.url;
  }

  return <aside className="cart-panel">
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
      <p>Tax is calculated by Stripe when enabled.</p>
      <button className="btn" disabled={loading} onClick={checkout}>
        {loading ? "OPENING STRIPE..." : "SECURE CHECKOUT"}
      </button>
    </div>}
  </aside>;
}
