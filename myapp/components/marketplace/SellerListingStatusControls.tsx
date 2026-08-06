"use client";

import type { Product, ProductStatus } from "@/lib/marketplace/types";
import { SELLER_STATUS_ACTIONS } from "@/lib/marketplace/product-status";
import { useSession } from "@/lib/auth-context";
import { useToast } from "./use-toast";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

type SellerListingStatusControlsProps = {
  product: Product;
  onUpdated?: (next: Product) => void;
  className?: string;
};

export function SellerListingStatusControls({
  product,
  onUpdated,
  className,
}: SellerListingStatusControlsProps) {
  const { supabase } = useSession();
  const { toast } = useToast();
  const [pending, setPending] = useState<ProductStatus | null>(null);

  const updateStatus = async (status: Exclude<ProductStatus, "hidden">) => {
    if (status === product.status) return;
    setPending(status);
    try {
      const payload: { status: ProductStatus; reserved_by: string | null } = {
        status,
        reserved_by: status === "reserved" ? product.reservedBy ?? null : null,
      };
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id);
      if (error) throw error;

      const next: Product = {
        ...product,
        status,
        reservedBy: payload.reserved_by ?? undefined,
      };
      onUpdated?.(next);
      toast({
        title: "Listing updated",
        description:
          status === "available"
            ? "Listing is available again."
            : status === "reserved"
              ? "Marked reserved — buyers still see it with a reserved badge."
              : "Marked sold — hidden from browse.",
      });
    } catch (error) {
      console.error("Error updating listing status:", error);
      toast({
        variant: "destructive",
        title: "Could not update status",
        description: "Please try again.",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className={className}>
      <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", marginBottom: 8 }}>
        Update Status
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SELLER_STATUS_ACTIONS.map((action) => {
          const isActive = product.status === action.status;
          return (
            <button
              key={action.status}
              type="button"
              className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
              style={{
                cursor: "pointer",
                borderRadius: "var(--radius)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              disabled={pending !== null || product.status === "hidden"}
              onClick={() => updateStatus(action.status)}
            >
              {isActive && <Icon name="ti-check" />}
              {pending === action.status ? "Saving…" : action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
