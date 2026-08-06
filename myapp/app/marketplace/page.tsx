import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { fetchRecentProducts } from "./_lib/queries";

export const dynamic = "force-dynamic";

export default async function MarketplaceHome() {
  let recent: Awaited<ReturnType<typeof fetchRecentProducts>> = [];
  let error = "";
  try {
    recent = await fetchRecentProducts(3);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="stack">
      <PageHero
        eyebrow="USM Marketplace"
        title="Campus secondhand marketplace"
        description="Browse campus listings, message sellers to arrange deals, and pay them directly — no payment gateway."
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <ButtonLink href="/marketplace/products" variant="primary">
          Browse Items
        </ButtonLink>
        <ButtonLink href="/marketplace/products/new">Sell an Item</ButtonLink>
      </div>

      {error && (
        <div className="notice-strip">Failed to load listings: {error}</div>
      )}

      <SectionHeader title="Recent Listings" icon="ti-tag" />

      {recent.length === 0 && !error ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <h3>No listings yet</h3>
          <p style={{ color: "var(--muted)" }}>Be the first to sell something!</p>
          <div style={{ marginTop: 14 }}>
            <ButtonLink href="/marketplace/products/new">Sell an Item</ButtonLink>
          </div>
        </div>
      ) : (
        <div className="products-grid">
          {recent.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <Link href="/marketplace/products" style={{ color: "var(--brand)", fontWeight: 800 }}>
        View all products &rarr;
      </Link>
    </div>
  );
}
