import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { CartProvider } from "@/components/CartProvider";
import CartButton from "@/components/CartButton";

export const metadata: Metadata = {
  title: "Jam's Cards",
  description: "Premium Pokémon cards, slabs, and sealed inventory from a collector who cares."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <header className="topbar">
            <div className="container header-shell">
              <Link className="brand" href="/">
                <span className="brand-mark" />
                <span>
                  <div className="brand-title">JAM'S CARDS</div>
                  <div className="brand-sub">Collector-owned inventory</div>
                </span>
              </Link>
              <nav className="nav">
                <Link href="/#shop">Inventory</Link>
                <Link href="/#about">About</Link>
                <a href="https://www.instagram.com/cardmanjam" target="_blank" rel="noreferrer">Instagram</a>
                <a href="https://x.com/cardmanjam" target="_blank" rel="noreferrer">X</a>
                <CartButton />
              </nav>
            </div>
          </header>
          {children}
          <footer>
            <div className="container footer-shell">
              <div>
                <strong>JAM'S CARDS</strong>
                <p>Collector-owned Pokémon cards from New Jersey.</p>
              </div>
              <div className="footer-links">
                <a href="https://www.instagram.com/cardmanjam" target="_blank" rel="noreferrer">Instagram</a>
                <a href="https://x.com/cardmanjam" target="_blank" rel="noreferrer">X</a>
                <a href="https://www.ebay.com/" target="_blank" rel="noreferrer">eBay</a>
                <a href="mailto:hello@jamscards.com">Email</a>
              </div>
            </div>
            <div className="container footer-note">Thanks for supporting a small collector.</div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
