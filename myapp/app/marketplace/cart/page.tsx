"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-context";
import { useCart } from "../_lib/cart-context";
import { Card } from "@/components/ui/Card";
import { PaymentDialog } from "@/components/marketplace/PaymentDialog";
import { buildLoginUrl } from "@/lib/marketplace/auth-redirect";
import type { CartItem } from "@/lib/marketplace/types";

export default function CartPage() {
  const { cartItems, removeFromCart, cartCount, isLoading } = useCart();

  if (isLoading) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Loading saved items…</h3>
        </Card>
      </div>
    );
  }

  if (cartCount === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <i className="ti ti-bookmark" style={{ fontSize: 48, color: "var(--muted)" }} />
        <h2 style={{ marginTop: 12 }}>No saved items</h2>
        <p style={{ color: "var(--muted)", maxWidth: 420, margin: "8px auto 0" }}>
          Save listings you like, then message the seller to arrange payment and meetup.
        </p>
        <div style={{ marginTop: 18 }}>
          <Link className="btn btn-primary" href="/marketplace/products">
            Browse Items
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <h1 style={{ marginBottom: 4 }}>Saved for later ({cartCount})</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Message the seller to buy. Deals are arranged in chat — the seller shares their own bank
        or QR. Marketplace does not process payments.
      </p>
      <div className="stack">
        {cartItems.map((item) => (
          <SavedItemCard key={item.product.id} item={item} onRemove={removeFromCart} />
        ))}
      </div>
    </div>
  );
}

function SavedItemCard({
  item,
  onRemove,
}: {
  item: CartItem;
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const { user } = useSession();
  const cover = item.product.imageUrls[0];

  const messageSeller = () => {
    const chatPath = `/marketplace/messages/${item.product.seller.id}?product=${item.product.id}`;
    if (!user) {
      router.push(buildLoginUrl(chatPath));
      return;
    }
    router.push(chatPath);
  };

  return (
    <Card style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt={item.product.name}
          style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 180 }}>
        <Link href={`/marketplace/products/${item.product.id}`} style={{ fontWeight: 700 }}>
          {item.product.name}
        </Link>
        <p style={{ margin: "2px 0", fontSize: 13, color: "var(--muted)" }}>
          Seller: {item.product.seller.name}
        </p>
        <strong style={{ color: "var(--brand-deep)" }}>RM {item.product.price.toFixed(2)}</strong>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button type="button" className="btn btn-sm" onClick={messageSeller}>
          <i className="ti ti-message-circle" /> Message seller
        </button>
        <PaymentDialog item={item}>
          <i className="ti ti-credit-card" /> Record deal
        </PaymentDialog>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onRemove(item.product.id)}
          aria-label="Remove from saved"
        >
          <i className="ti ti-trash" style={{ color: "var(--danger)" }} />
        </button>
      </div>
    </Card>
  );
}
