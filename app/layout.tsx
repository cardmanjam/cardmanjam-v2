import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { CartProvider } from "@/components/CartProvider";
import CartButton from "@/components/CartButton";

export const metadata: Metadata = {
  title: "Card Man Jam | The Vault",
  description: "Hand-picked cards, slabs and sealed collector finds."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <header className="topbar">
            <Link className="brand" href="/">
              <span className="orb" />
              <span>
                <div className="brand-title">CARD MAN JAM</div>
                <div className="brand-sub">HAND-PICKED CARD VAULT</div>
              </span>
            </Link>
            <nav className="nav">
              <Link href="/#shop">SHOP</Link>
              <Link href="/admin">ADMIN</Link>
              <CartButton />
            </nav>
          </header>
          {children}
          <footer>
            <strong>Card Man Jam</strong>
            <p>Independent collectible card seller based in New Jersey.</p>
            <p>Terms • Privacy • Shipping • Returns — replace draft policies before public launch.</p>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
