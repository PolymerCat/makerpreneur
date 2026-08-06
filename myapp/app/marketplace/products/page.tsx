import { PageHero } from "@/components/layout/PageHero";
import { ProductsList } from "@/components/marketplace/ProductsList";
import { fetchBrowseableProducts } from "../_lib/queries";
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products: Awaited<ReturnType<typeof fetchBrowseableProducts>> = [];
  let error = "";
  try {
    products = await fetchBrowseableProducts();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="stack">
      <PageHero
        eyebrow="Marketplace"
        title="Browse listings"
        description="Filter by category, price, or keyword."
      />

      {error && <div className="notice-strip">Failed to load listings: {error}</div>}

      <ProductsList products={products} />
    </div>
  );
}
