"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type { Deal, Product, User } from "@/lib/marketplace/types";
import {
  agreeDeal,
  availableDealActions,
  cancelDeal,
  completeDeal,
  dealStatusLabel,
  expressInterest,
  fetchDealForChatProduct,
  formatDealRpcError,
  isOpenDeal,
  type DealAction,
} from "@/app/marketplace/_lib/deals";
import { useSession } from "@/lib/auth-context";
import { mapProductRow, type ProductRow } from "@/app/marketplace/_lib/mappers";
import { useToast } from "./use-toast";

type ChatDealPanelProps = {
  currentUser: User;
  otherUser: User;
  product: Product;
  chatId: string;
  onProductChange?: (product: Product) => void;
};

export function ChatDealPanel({
  currentUser,
  otherUser,
  product,
  chatId,
  onProductChange,
}: ChatDealPanelProps) {
  const { supabase } = useSession();
  const { toast } = useToast();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [busy, setBusy] = useState<DealAction | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProduct = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("*, profiles:seller_id(*)")
      .eq("id", product.id)
      .single();
    if (data) {
      onProductChange?.(mapProductRow(data as ProductRow));
    }
  }, [supabase, product.id, onProductChange]);

  const loadDeal = useCallback(async () => {
    try {
      const next = await fetchDealForChatProduct(supabase, {
        productId: product.id,
        chatId,
        userId: currentUser.id,
      });
      setDeal(next);
    } catch (error) {
      console.error("Error loading deal:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, product.id, chatId, currentUser.id]);

  useEffect(() => {
    setLoading(true);
    loadDeal();

    const channel = supabase
      .channel(`deals:${product.id}:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
          filter: `product_id=eq.${product.id}`,
        },
        () => {
          loadDeal();
          void refreshProduct();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, product.id, chatId, loadDeal, refreshProduct]);

  const actions = availableDealActions({
    deal,
    product,
    currentUserId: currentUser.id,
    otherUserId: otherUser.id,
  });

  const isSeller = product.seller.id === currentUser.id;
  const dealWithThisChat =
    !!deal &&
    deal.chatId === chatId &&
    (deal.buyerId === currentUser.id || deal.sellerId === currentUser.id);
  const openDealElsewhere =
    isSeller &&
    product.status === "reserved" &&
    product.reservedBy &&
    product.reservedBy !== otherUser.id;

  const runAction = async (action: DealAction) => {
    setBusy(action);
    try {
      let next: Deal;
      if (action === "interested") {
        next = await expressInterest({
          supabase,
          product,
          chatId,
          currentUser,
          otherUser,
        });
        toast({
          title: "Interest sent",
          description: "The seller was notified. Wait for them to agree or cancel.",
        });
      } else if (action === "agree") {
        if (!deal) throw new Error("No deal to agree");
        next = await agreeDeal(supabase, deal.id);
        toast({
          title: "Deal agreed",
          description: "Listing marked reserved. Arrange payment and meetup in chat.",
        });
      } else if (action === "complete") {
        if (!deal) throw new Error("No deal to complete");
        next = await completeDeal(supabase, deal.id);
        toast({
          title: "Deal completed",
          description: "Listing marked sold. Purchase history updated for both of you.",
        });
      } else {
        if (!deal) throw new Error("No deal to cancel");
        next = await cancelDeal(supabase, deal.id);
        toast({
          title: "Deal cancelled",
          description: "This deal was cancelled.",
        });
      }
      setDeal(next);
      await refreshProduct();
    } catch (error) {
      console.error("Deal action failed:", error);
      toast({
        variant: "destructive",
        title: "Could not update deal",
        description: formatDealRpcError(error),
      });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>Loading deal status…</p>;
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      {deal && dealWithThisChat && (
        <div>
          <Badge tone={isOpenDeal(deal.status) ? "brand" : "neutral"}>
            Deal: {dealStatusLabel(deal.status)}
          </Badge>
        </div>
      )}

      {!dealWithThisChat && product.status === "reserved" && !isSeller && (
        <p style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>
          This item is reserved. You can still chat, but a new deal can&apos;t be started right now.
        </p>
      )}

      {openDealElsewhere && (
        <p style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>
          This listing is reserved with another buyer. Deal actions are in that chat.
        </p>
      )}

      {product.status === "sold" && (
        <p style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>
          This listing is sold.
        </p>
      )}

      {actions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {actions.includes("interested") && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => runAction("interested")} disabled={busy !== null}>
              {busy === "interested" ? "Saving…" : "I'm interested"}
            </button>
          )}
          {actions.includes("agree") && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => runAction("agree")} disabled={busy !== null}>
              {busy === "agree" ? "Saving…" : "Agree & reserve"}
            </button>
          )}
          {actions.includes("complete") && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => runAction("complete")} disabled={busy !== null}>
              {busy === "complete" ? "Saving…" : "Mark completed"}
            </button>
          )}
          {actions.includes("cancel") && (
            <button type="button" className="btn btn-sm" onClick={() => runAction("cancel")} disabled={busy !== null}>
              {busy === "cancel" ? "Saving…" : "Cancel deal"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
