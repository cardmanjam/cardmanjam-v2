import ProductGrid from "@/components/ProductGrid";
import JamPortrait from "@/components/JamPortrait";
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
        <h1>Pokemon cards from my personal collection world, not a faceless storefront.</h1>
        <p>I'm Jam, a collector and active vendor from New Jersey.</p>
        <p>Every order helps me keep The Hunt going and put more Pokemon cards into more hands.</p>
        <div className="hero-actions">
          <a className="btn" href="#shop">Browse My Vault</a>
          <a className="btn secondary" href="#about">Meet Jam</a>
        </div>
        <div className="hero-meta">
          <span>✓ Picked by Jam</span>
          <span>✓ Ships From New Jersey</span>
          <span>✓ Packed Like My Own Collection</span>
          <span>✓ New Cards Coming In Regularly</span>
        </div>
      </div>
      <JamPortrait />
    </section>

    <section className="container section giveaway-section hunt-section">
      <div className="giveaway-copy">
        <p className="eyebrow">THE HUNT</p>
        <h2>I'm giving Pokémon cards to people around the world.</h2>
        <p>It starts here in New Jersey.</p>
        <p>I'm hiding free Pokémon cards in parks, local businesses, downtown areas, and community spots—but that's only the beginning.</p>
        <p>My goal is to grow The Hunt into a worldwide movement that gets more cards into more hands.</p>
        <p>No purchase necessary.</p>
        <p>Follow along for clues, giveaways, and every new drop.</p>
        <p>Find it. Keep it. Pass the joy forward.</p>
        <div className="hero-actions">
          <a className="btn secondary" href="https://www.instagram.com/cardmanjam" target="_blank" rel="noreferrer">Follow the Hunt on Instagram</a>
          <a className="btn" href="https://x.com/cardmanjam" target="_blank" rel="noreferrer">Follow on X</a>
        </div>
        <p className="hunt-support">It starts here in New Jersey, but I want the joy of the hobby to travel anywhere it can.</p>
      </div>
      <div className="hunt-visual" aria-hidden="true">
        <div className="hunt-world">
          <span className="hunt-marker hunt-marker--nj"></span>
          <span className="hunt-marker hunt-marker--global"></span>
          <span className="hunt-path hunt-path--one"></span>
          <span className="hunt-path hunt-path--two"></span>
          <span className="hunt-card hunt-card--one"></span>
          <span className="hunt-card hunt-card--two"></span>
        </div>
      </div>
    </section>

    <section className="container section why-section">
      <div className="section-head">
        <p className="eyebrow">WHY BUY FROM JAM?</p>
        <h2>Real collector energy, honest listing habits.</h2>
      </div>
      <div className="benefit-grid">
        <article className="benefit-card">
          <div className="benefit-icon">📸</div>
          <h3>I photograph every card individually</h3>
          <p>I want you to see the exact card you're buying and judge the condition for yourself.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">📦</div>
          <h3>I pack orders like they're mine</h3>
          <p>I ship every order the way I'd want my own collection handled.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">⚡</div>
          <h3>Fast shipping with tracking</h3>
          <p>I keep turnaround quick and make sure every order goes out with tracking.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">🧭</div>
          <h3>Honest descriptions</h3>
          <p>No inflated claims, no corporate filler, just the details that matter to collectors.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">🗂️</div>
          <h3>My inventory keeps moving</h3>
          <p>I'm constantly buying, selling, and trading, so new cards are always finding their way into the Vault.</p>
        </article>
        <article className="benefit-card">
          <div className="benefit-icon">🎁</div>
          <h3>Every purchase supports The Hunt</h3>
          <p>When you buy from me, you're also helping me fund future giveaways and community drops.</p>
        </article>
      </div>
    </section>

    <section className="container section value-section">
      <div className="value-shell">
        <div className="section-head value-head">
          <p className="eyebrow">THE VAULT APPROACH</p>
          <h2>Great Cards, Realistic Prices</h2>
        </div>
        <div className="value-copy">
          <p>You don't need a six-figure budget to build a collection you love.</p>
          <p>I specialize in carefully selected singles and graded cards priced under $500. Social media can make this hobby look like it's all about massive purchases and expensive trophy cards, but I've found just as much joy in discovering incredible artwork, overlooked cards, and pieces of Pokemon history that don't cost a fortune.</p>
          <p>I personally select every card that enters the Vault. Whether it's a vintage holo, a unique promo, an affordable slab, or simply a card with artwork I love, I'm always looking for the best combination of character, condition, and value.</p>
          <p>I'm Jam, an active collector and vendor from New Jersey. I'm constantly buying, selling, and trading, so there's always something new making its way into the Vault. I want this to feel like you're browsing a collector's hand-picked inventory, not scrolling through another massive, impersonal marketplace.</p>
          <p>Whether you've been collecting for years or you're buying your first graded card, you're welcome here. Collect what you love, enjoy the hunt, and remember: you don't need to spend a fortune to own something meaningful.</p>
        </div>
      </div>
    </section>

    <section id="about" className="container section about-grid about-grid--text-only">
      <div className="about-copy">
        <p className="eyebrow">MEET JAM</p>
        <h2>Hey, I'm Jam.</h2>
        <p>My name's Mike, but almost everyone knows me as Jam.</p>
        <p>I've loved Pokemon since I was a kid, and collecting eventually turned into buying, selling, trading, and spending weekends behind tables at card shows.</p>
        <p>I'm an active collector and vendor from New Jersey, and I personally source the inventory you see here.</p>
        <p>Most of what I focus on is singles and slabs under $500. I'm always looking for cards with interesting artwork, hobby history, strong eye appeal, solid condition, and real collector value.</p>
        <p>Because I'm always active in the hobby, new cards regularly make their way into My Vault. If you're a longtime collector or just picking up your first slab, you're welcome here.</p>
        <a className="btn" href="#shop">Browse My Vault</a>
      </div>
    </section>

    <section className="container section about-grid reverse">
      <div className="about-photo-card about-photo-card--wide">
        <img src="/about/jam-vendor-actual.jpeg" alt="Jam behind a vendor table" />
      </div>
      <div className="about-copy">
        <p className="eyebrow">CARD SHOWS</p>
        <h2>You'll probably find me behind a table.</h2>
        <p>Most weekends I'm somewhere in New Jersey buying collections, making trades, selling cards, and talking Pokemon with anyone who wants to chat.</p>
        <p>If you see me, come say hi.</p>
      </div>
    </section>

    <section id="shop" className="container section">
      <div className="section-head">
        <p className="eyebrow">MY VAULT</p>
        <h2>What's in My Vault Right Now</h2>
      </div>
      <ProductGrid products={products}/>
    </section>

    <section className="container section cta-banner">
      <div>
        <p className="eyebrow">READY TO KEEP HUNTING?</p>
        <h2>Take a look through My Vault and see what speaks to you.</h2>
      </div>
      <a className="btn" href="#shop">SHOP MY VAULT</a>
    </section>
  </main>;
}
