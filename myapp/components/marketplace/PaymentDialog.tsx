"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { CartItem } from "@/lib/marketplace/types";
import { useSession } from "@/lib/auth-context";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "./use-toast";
import { notifyDealRecorded } from "@/app/marketplace/_lib/notifications";

type DealMethod = "qr" | "cash_meetup";

export function PaymentDialog({ item, children }: { item: CartItem; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select_method" | "confirm">("select_method");
  const [paymentMethod, setPaymentMethod] = useState<DealMethod>("qr");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, supabase } = useSession();

  const sellerQrUrl = item.product.seller.qrCodeUrl;

  const initiateDeal = async (method: DealMethod) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Please log in",
        description: "You must be logged in to record a deal.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          buyer_id: user.id,
          seller_id: item.product.seller.id,
          product_name: item.product.name,
          product_image: item.product.imageUrls[0] ?? "",
          price: item.product.price,
          seller_name: item.product.seller.name,
          buyer_name:
            (user.user_metadata?.name as string) || user.email || "Anonymous Buyer",
          status: "Pending",
        })
        .select("id")
        .single();
      if (purchaseError) throw purchaseError;

      const { error: cartError } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", item.product.id);
      if (cartError) throw cartError;

      await notifyDealRecorded(supabase, {
        purchaseId: purchase.id,
        method,
        productId: item.product.id,
      });

      toast({
        title: "Seller notified",
        description: "Deal recorded as pending. Pay the seller directly — marketplace does not process payments.",
      });
      setOpen(false);
    } catch (error) {
      console.error("Deal recording failed: ", error);
      toast({
        variant: "destructive",
        title: "Could not record deal",
        description: "Please try again, or message the seller in chat.",
      });
    } finally {
      setIsSubmitting(false);
      setStep("select_method");
    }
  };

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        {children}
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setTimeout(() => {
            setStep("select_method");
            setPaymentMethod("qr");
            setIsSubmitting(false);
          }, 150);
        }}
        title="Record campus deal"
        footer={
          step === "select_method" ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep("confirm")}>
              Continue
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setStep("select_method")}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => initiateDeal(paymentMethod)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Notifying…" : "Notify seller"}
              </button>
            </>
          )
        }
      >
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          {step === "select_method"
            ? `Choose how you will pay the seller for ${item.product.name}. Marketplace does not process or verify payments.`
            : paymentMethod === "qr"
              ? "Pay the seller directly using their QR, then notify them."
              : "Arrange a public campus meetup and pay in cash."}
        </p>

        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px" }}>
          <div>
            <strong>{item.product.name}</strong>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Seller: {item.product.seller.name}
            </p>
          </div>
          <strong style={{ fontSize: 18, color: "var(--brand-deep)" }}>
            RM {item.product.price.toFixed(2)}
          </strong>
        </div>

        {step === "select_method" ? (
          <div className="stack">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                border: `2px solid ${paymentMethod === "qr" ? "var(--brand)" : "var(--line)"}`,
                borderRadius: 10,
                cursor: "pointer",
                background: paymentMethod === "qr" ? "var(--brand-soft)" : "var(--surface)",
              }}
            >
              <input
                type="radio"
                name="deal-method"
                checked={paymentMethod === "qr"}
                onChange={() => setPaymentMethod("qr")}
              />
              <i className="ti ti-qrcode" />
              <span>Seller QR / e-wallet</span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                border: `2px solid ${paymentMethod === "cash_meetup" ? "var(--brand)" : "var(--line)"}`,
                borderRadius: 10,
                cursor: "pointer",
                background: paymentMethod === "cash_meetup" ? "var(--brand-soft)" : "var(--surface)",
              }}
            >
              <input
                type="radio"
                name="deal-method"
                checked={paymentMethod === "cash_meetup"}
                onChange={() => setPaymentMethod("cash_meetup")}
              />
              <i className="ti ti-handshake" />
              <span>Cash on meetup</span>
            </label>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 16 }}>
            {paymentMethod === "qr" ? (
              sellerQrUrl ? (
                <>
                  <p style={{ fontSize: 14 }}>
                    Scan the seller&apos;s QR to pay{" "}
                    <strong>RM {item.product.price.toFixed(2)}</strong>, then notify them.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sellerQrUrl}
                    alt="Seller payment QR code"
                    style={{ width: 200, height: 200, margin: "10px auto", borderRadius: 8, border: "2px solid var(--line)" }}
                  />
                </>
              ) : (
                <div className="stack">
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>
                    This seller has not uploaded a payment QR yet. Message them in chat for
                    bank/QR details, or notify them after you arrange payment.
                  </p>
                  <Link
                    className="btn btn-sm btn-secondary"
                    href={`/marketplace/messages/${item.product.seller.id}?product=${item.product.id}`}
                  >
                    Message seller
                  </Link>
                </div>
              )
            ) : (
              <p style={{ fontSize: 14 }}>
                Meet in a public campus spot, exchange cash and the item, then notify the seller
                so they can confirm the deal.
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
