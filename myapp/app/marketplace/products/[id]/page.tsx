import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/PageHero";
import { ProductDetail } from "@/components/marketplace/ProductDetail";
import { fetchProductById } from "../../_lib/queries";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let product;
  try {
    product = await fetchProductById(id);
  } catch {
    product = null;
  }
  if (!product) notFound();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      <ProductDetail product={product} />
    </div>
  );
}
