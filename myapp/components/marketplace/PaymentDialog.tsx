"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { CartItem } from "@/lib/marketplace/types";
import { useSession } from "@/lib/auth-context";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "./use-toast";
import { notifyDealRecorded } from "@/app/marketplace/_lib/notifications";
import { displayNameFromProfile, type ProfileRow } from "@/app/marketplace/_lib/mappers";

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
      let sellerName = item.product.seller.name;
      if (!sellerName || sellerName === "Student" || sellerName === "Unknown") {
        const { data: sellerProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", item.product.seller.id)
          .maybeSingle();
        if (sellerProfile) {
          sellerName = displayNameFromProfile(sellerProfile as ProfileRow);
        }
      }

      const buyerName =
        displayNameFromProfile({
          name: (user.user_metadata?.name as string) || null,
          full_name: (user.user_metadata?.full_name as string) || null,
          email: user.email || null,
        }) ||
        user.email ||
        "Anonymous Buyer";

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          buyer_id: user.id,
          seller_id: item.product.seller.id,
          product_name: item.product.name,
          product_image: item.product.imageUrls[0] ?? "",
          price: item.product.price,
          seller_name: sellerName,
          buyer_name: buyerName,
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
        <p className="mp-payment-muted">
          {step === "select_method"
            ? `Choose how you will pay the seller for ${item.product.name}. Marketplace does not process or verify payments.`
            : paymentMethod === "qr"
              ? "Pay the seller directly using their QR, then notify them."
              : "Arrange a public campus meetup and pay in cash."}
        </p>

        <div className="card mp-payment-summary">
          <div>
            <strong>{item.product.name}</strong>
            <p className="mp-payment-seller">
              Seller: {item.product.seller.name}
            </p>
          </div>
          <strong className="mp-payment-price">
            RM {item.product.price.toFixed(2)}
          </strong>
        </div>

        {step === "select_method" ? (
          <div className="stack">
            <label
              className={`mp-payment-method${paymentMethod === "qr" ? " is-selected" : ""}`}
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
              className={`mp-payment-method${paymentMethod === "cash_meetup" ? " is-selected" : ""}`}
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
          <div className="card mp-payment-confirm">
            {paymentMethod === "qr" ? (
              sellerQrUrl ? (
                <>
                  <p className="mp-payment-muted">
                    Scan the seller&apos;s QR to pay{" "}
                    <strong>RM {item.product.price.toFixed(2)}</strong>, then notify them.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sellerQrUrl}
                    alt="Seller payment QR code"
                    className="mp-payment-qr-img"
                  />
                </>
              ) : (
                <div className="stack">
                  <p className="mp-payment-muted">
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
              <p className="mp-payment-muted">
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
