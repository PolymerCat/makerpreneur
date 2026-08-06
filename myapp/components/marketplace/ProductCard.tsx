import Link from "next/link";
import type { Product } from "@/lib/marketplace/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { statusBadgeLabel } from "@/lib/marketplace/product-status";
import { conditionLabel } from "@/lib/marketplace/product-condition";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const statusLabel = statusBadgeLabel(product.status);
  const coverUrl = product.imageUrls[0];

  return (
    <Card className="product-card">
      <Link href={`/marketplace/products/${product.id}`} className="product-card-link">
        <div className="product-card-image">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={product.name} loading="lazy" />
          ) : (
            <div className="product-card-image-empty">
              <span>No photo</span>
            </div>
          )}
          {statusLabel && <Badge tone="warning">{statusLabel}</Badge>}
        </div>
        <div className="product-card-body">
          <div className="product-card-tags">
            <Badge>{product.category.name}</Badge>
            <Badge tone="neutral">{conditionLabel(product.condition)}</Badge>
          </div>
          <h3>{product.name}</h3>
          <strong className="product-card-price">RM {product.price.toFixed(2)}</strong>
          <span className="product-card-seller">by {product.seller.name}</span>
        </div>
      </Link>
    </Card>
  );
}
