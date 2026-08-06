"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Legacy mock checkout route. Marketplace does not process payments.
 * Deals are arranged in chat or recorded from Saved items.
 */
export default function CheckoutPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/marketplace/cart");
  }, [router]);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center", padding: "60px 0" }}>
      <h2>No in-app checkout</h2>
      <p style={{ color: "var(--muted)" }}>
        Marketplace does not process payments. Message the seller to arrange a deal, or record a
        pending deal from your saved items after you pay them directly.
      </p>
      <div className="form-actions" style={{ justifyContent: "center" }}>
        <Link className="btn btn-primary" href="/marketplace/cart">
          Go to saved items
        </Link>
        <Link className="btn" href="/marketplace/products">
          Browse listings
        </Link>
      </div>
    </div>
  );
}
