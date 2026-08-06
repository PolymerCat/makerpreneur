"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/marketplace/types";
import { useSession } from "@/lib/auth-context";
import { useMarketplaceUser } from "@/app/marketplace/_lib/MarketplaceProvider";
import { useCart } from "@/app/marketplace/_lib/cart-context";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { ProductImages } from "./ProductImages";
import { ReportProductDialog } from "./ReportProductDialog";
import { SellerListingStatusControls } from "./SellerListingStatusControls";
import { useToast } from "./use-toast";
import { statusBadgeLabel, canMessageOrSave } from "@/lib/marketplace/product-status";
import { conditionLabel } from "@/lib/marketplace/product-condition";
import { shareListing } from "@/lib/marketplace/share-listing";
import { buildLoginUrl } from "@/lib/marketplace/auth-redirect";
import { adminRestoreListing, formatAdminReportError } from "@/app/marketplace/_lib/admin-reports";
import { notifyAdminDeletedListing, notifySellerOfReport } from "@/app/marketplace/_lib/notifications";

export function ProductDetail({ product: initial }: { product: Product }) {
  const router = useRouter();
  const { user, supabase } = useSession();
  const { isAdmin } = useMarketplaceUser();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSeller = user ? user.id === product.seller.id : false;
  const statusLabel = statusBadgeLabel(product.status);
  const actionsEnabled = canMessageOrSave(product.status);
  const statusBanner =
    product.status === "reserved"
      ? "This item is reserved — message the seller to check if a deal is still open."
      : product.status === "sold"
        ? "This item has been sold and is no longer available."
        : product.status === "hidden"
          ? "This listing is unavailable."
          : null;

  const handleContactSeller = () => {
    const chatPath = `/marketplace/messages/${product.seller.id}?product=${product.id}`;
    if (!user) {
      router.push(buildLoginUrl(chatPath));
      return;
    }
    router.push(chatPath);
  };

  const handleShareListing = async () => {
    const result = await shareListing({
      id: product.id,
      name: product.name,
      price: product.price,
    });
    if (result.ok) {
      toast({
        title: result.method === "native" ? "Shared" : "Link copied",
        description:
          result.method === "native"
            ? "Listing ready to send in WhatsApp or Telegram."
            : "Link copied — paste into WhatsApp or Telegram.",
      });
      return;
    }
    if (result.reason === "aborted") return;
    toast({
      variant: "destructive",
      title: "Could not copy link",
      description: `Copy this URL manually: ${result.url}`,
    });
  };

  const handleSave = async () => {
    try {
      await addToCart(product);
      toast({ title: "Saved for later", description: "Found in your saved items." });
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        variant: "destructive",
        title: "Could not save",
        description: "Please try again.",
      });
    }
  };

  const reportProduct = async (reason: string) => {
    if (!user || !product) throw new Error("Not ready to report");
    const { error: reportError } = await supabase.from("reports").insert({
      product_id: product.id,
      product_name: product.name,
      reported_by_id: user.id,
      reported_by_name: (user.user_metadata?.name as string) || user.email || "User",
      reason,
      status: "open",
    });
    if (reportError) throw reportError;
    await notifySellerOfReport(supabase, { productId: product.id, reason });
  };

  const handleRestoreListing = async () => {
    if (!product || !isAdmin) return;
    try {
      await adminRestoreListing(supabase, product.id);
      setProduct({ ...product, status: "available", reservedBy: undefined });
      toast({ title: "Listing restored", description: "Back in browse as available. Seller notified." });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Could not restore listing",
        description: formatAdminReportError(error),
      });
    }
  };

  const handleDeleteProduct = async () => {
    if (!product || !(isSeller || isAdmin)) return;
    try {
      const sellerId = product.seller.id;
      const productName = product.name;
      const productId = product.id;

      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;

      if (isAdmin && !isSeller) {
        await notifyAdminDeletedListing(supabase, { productId, productName, sellerId });
      }

      toast({
        title: "Product Deleted",
        description: `${productName} has been removed from the marketplace.`,
      });
      router.push("/marketplace/products");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not delete the product.",
      });
    }
  };

  return (
    <div>
      {/* Top Breadcrumb Back Navigation */}
      <div style={{ marginBottom: 18 }}>
        <Link
          href="/marketplace/products"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--muted)",
            textDecoration: "none",
          }}
        >
          <Icon name="ti-arrow-left" /> Back to listings
        </Link>
      </div>

      <div className="two-column" style={{ alignItems: "start", gap: 28 }}>
        {/* Left Column: Product Image Gallery */}
        <div>
          <ProductImages images={product.imageUrls} productName={product.name} />
        </div>

        {/* Right Column: Details & Actions */}
        <div className="stack" style={{ gap: 20 }}>
          {/* Header & Price Info */}
          <div className="stack" style={{ gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Badge tone="brand">{product.category.name}</Badge>
              <Badge tone="neutral">{conditionLabel(product.condition)}</Badge>
              {statusLabel && <Badge tone="warning">{statusLabel}</Badge>}
            </div>

            <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
              {product.name}
            </h1>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--brand-deep)" }}>
                RM {product.price.toFixed(2)}
              </span>
            </div>

            {statusBanner && <div className="notice-strip">{statusBanner}</div>}
          </div>

          {/* Description Card */}
          <Card style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>Description</h3>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text)", lineHeight: 1.6, fontSize: 15 }}>
              {product.description || "No description provided."}
            </p>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--muted)" }}>
              <Icon name="ti-clock" /> Listed on: {product.dateAdded ? new Date(product.dateAdded).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "N/A"}
            </div>
          </Card>

          {/* Seller Information Card */}
          <Card style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Seller Information
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "var(--brand-soft)",
                  color: "var(--brand-deep)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 18,
                  border: "1px solid var(--brand-mid)",
                }}
              >
                {(product.seller.name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <strong style={{ fontSize: 16, display: "block" }}>{product.seller.name}</strong>
                {product.seller.isVerified ? (
                  <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="ti-shield-check" /> Verified USM Student
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>USM Student</span>
                )}
              </div>
            </div>
          </Card>

          {/* Action Buttons Section */}
          {!isSeller ? (
            <div className="stack" style={{ gap: 12 }}>
              {actionsEnabled && (
                <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
                  Arrange meetup and payment directly with seller via chat. StudentHub does not charge fees or process payments.
                </p>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: "1 1 180px", height: 44, cursor: "pointer", fontSize: 15 }}
                  onClick={handleContactSeller}
                  disabled={!actionsEnabled}
                >
                  <Icon name="ti-message-circle" /> Message seller to buy
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ height: 44, cursor: "pointer", padding: "0 18px" }}
                  onClick={handleSave}
                  disabled={!actionsEnabled}
                >
                  <Icon name="ti-bookmark" /> Save
                </button>
              </div>
              <button type="button" className="btn btn-ghost" onClick={handleShareListing} style={{ cursor: "pointer" }}>
                <Icon name="ti-share" /> Share listing link
              </button>
            </div>
          ) : (
            <Card style={{ padding: 18, background: "var(--surface)", border: "2px solid var(--brand-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-deep)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="ti-user-check" /> Your Listing Management
                </span>
              </div>
              
              <SellerListingStatusControls product={product} onUpdated={setProduct} />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleShareListing} style={{ cursor: "pointer" }}>
                  <Icon name="ti-share" /> Share link
                </button>
                {isSeller && (
                  <Link className="btn btn-secondary btn-sm" href={`/marketplace/products/${product.id}/edit`}>
                    <Icon name="ti-edit" /> Edit
                  </Link>
                )}
                {isAdmin && product.status === "hidden" && (
                  <button type="button" className="btn btn-sm btn-secondary" onClick={handleRestoreListing}>
                    Restore listing
                  </button>
                )}
                <button type="button" className="btn btn-sm" onClick={() => setConfirmDelete(true)} style={{ cursor: "pointer", color: "var(--warning)", borderColor: "var(--warning)" }}>
                  <Icon name="ti-trash" /> {isAdmin ? "Delete (Admin)" : "Delete"}
                </button>
              </div>
            </Card>
          )}

          {user && !isSeller && !isAdmin && (
            <div style={{ marginTop: 4 }}>
              <ReportProductDialog onReport={reportProduct} />
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Are you absolutely sure?"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDeleteProduct}>
              Yes, delete
            </button>
          </>
        }
      >
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          This action cannot be undone. This will permanently delete this product listing.
        </p>
      </Dialog>
    </div>
  );
}
