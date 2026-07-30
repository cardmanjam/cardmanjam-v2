import ProductGrid from "@/components/ProductGrid";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProducts(): Promise<Product[]> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("status", "active")
      .gt("quantity", 0)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Product[];
  } catch {
    return [];
  }
}

export default async function Home() {
  const products = await getProducts();

  return <main>
    <section className="container hero">
      <div className="hero-copy">
        <p className="eyebrow">JAM'S CARDS</p>
        <h1>Pokémon cards from a collector—not a corporation.</h1>
        <p>Every purchase helps fund free Pokémon giveaways across New Jersey.</p>
        <p>Buy a card. Help make someone's day.</p>
        <div className="hero-actions">
          <a className="btn" href="#shop">Browse Inventory</a>
          <a className="btn secondary" href="#about">Meet Jam</a>
        </div>
        <div className="hero-meta">
          <span>✓ Collector Owned</span>
          <span>✓ Ships From New Jersey</span>
          <span>✓ Packed Like My Own Collection</span>
          <span>✓ New Inventory Weekly</span>
        </div>
      </div>
      <div className="hero-visual">
        <div className="hero-panel-card">
          <p className="eyebrow">THE HUNT</p>
          <h2>Free Pokémon are hidden across New Jersey.</h2>
          <p>Every week I hide cards around parks, local businesses, downtown areas, and community spots. Follow along for clues. Find it. Keep it.</p>
        </div>
      </div>
    </section>

    <section className="container section giveaway-section">
      <div className="giveaway-copy">
        <p className="eyebrow">THE HUNT</p>
        <h2>Free Pokémon are hidden across New Jersey.</h2>
        <p>Every week I hide Pokémon cards around parks, local businesses, downtown areas, and community spots.</p>
        <p>No purchase necessary. Follow along for clues. Find it. Keep it.</p>
        <div className="hero-actions">
          <a className="btn secondary" href="https://www.instagram.com/cardmanjam" target="_blank" rel="noreferrer">Follow on Instagram</a>
          <a className="btn" href="https://x.com/cardmanjam" target="_blank" rel="noreferrer">Follow on X</a>
        </div>
      </div>
    </section>

    <section className="container section why-section">
      <div className="section-head">
        <p className="eyebrow">WHY BUY FROM JAM?</p>
        <h2>Premium service, real collector energy.</h2>
      </div>
      <div className="benefit-grid">
        <article className="benefit-card">
          <div className="benefit-icon">📸</div>
          <h3>Every card photographed individually</h3>
          <p>Clean photos, clear condition, and honest presentation.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">📦</div>
          <h3>Collector packed</h3>
          <p>Every order is packed exactly how I'd want my own cards shipped.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">⚡</div>
          <h3>Fast shipping</h3>
          <p>Quick turnaround with tracking on every order.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">🧭</div>
          <h3>Honest descriptions</h3>
          <p>No hype, no fluff, just clear details that matter.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">🗂️</div>
          <h3>New inventory every week</h3>
          <p>Fresh listings and fresh finds are always coming in.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">🎁</div>
          <h3>Every purchase supports giveaways</h3>
          <p>Every order helps fund future hidden-card drops and community moments.</p>
        </article>
      </div>
    </section>

    <section id="about" className="container section about-grid">
      <div className="about-photo-card about-photo-card--portrait">
        <img src="/about/jam-smiling-actual.jpeg" alt="Jam smiling" />
      </div>
      <div className="about-copy">
        <p className="eyebrow">MEET JAM</p>
        <h2>Hey, I'm Jam.</h2>
        <p>My name's Mike, but almost everyone knows me as Jam.</p>
        <p>I've loved Pokémon since I was a kid.</p>
        <p>Collecting turned into buying, selling, trading, and spending weekends behind tables at card shows.</p>
        <p>Jam's Cards isn't trying to become the biggest card shop.</p>
        <p>I'm trying to become the one collectors trust the most.</p>
        <p>Every order supports future giveaways, better content, and getting more Pokémon cards into more hands.</p>
        <a className="btn" href="#shop">Browse Inventory</a>
      </div>
    </section>

    <section className="container section about-grid reverse">
      <div className="about-photo-card about-photo-card--wide">
        <img src="/about/jam-vendor-actual.jpeg" alt="Jam behind a vendor table" />
      </div>
      <div className="about-copy">
        <p className="eyebrow">CARD SHOWS</p>
        <h2>You'll probably find me behind a table.</h2>
        <p>Most weekends I'm somewhere in New Jersey buying collections, making trades, selling inventory, and talking Pokémon.</p>
        <p>If you see me...</p>
        <p>come say hi.</p>
      </div>
    </section>

    <section id="shop" className="container section">
      <div className="section-head">
        <p className="eyebrow">LATEST INVENTORY</p>
        <h2>Latest Inventory</h2>
      </div>
      <ProductGrid products={products}/>
    </section>

    <section className="container section cta-banner">
      <div>
        <p className="eyebrow">READY FOR YOUR NEXT GRAIL?</p>
        <h2>Find the next one worth keeping.</h2>
      </div>
      <a className="btn" href="#shop">SHOP NOW</a>
    </section>
  </main>;
}
