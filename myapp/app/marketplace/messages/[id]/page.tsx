"use client";

import { useSearchParams, notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChatBox } from "@/components/marketplace/ChatBox";
import { useSession } from "@/lib/auth-context";
import { mapProfileToUser, mapProductRow, type ProfileRow, type ProductRow } from "@/app/marketplace/_lib/mappers";
import type { User, Product } from "@/lib/marketplace/types";
import { useToast } from "@/components/marketplace/use-toast";
import { buildLoginUrl } from "@/lib/marketplace/auth-redirect";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default function MessagePage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, supabase } = useSession();
  const otherUserId = params.id as string;

  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [relatedProduct, setRelatedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loggedInProfile, setLoggedInProfile] = useState<User | null>(null);
  const [isSelfChat, setIsSelfChat] = useState(false);

  useEffect(() => {
    if (!otherUserId) return;

    if (currentUser && otherUserId === currentUser.id) {
      setIsSelfChat(true);
      setIsLoading(false);
      toast({
        title: "Can't message yourself",
        description: "Open a listing and message the seller instead.",
      });
      router.replace("/marketplace/messages");
      return;
    }

    setIsSelfChat(false);
    setIsLoading(true);
    const productId = searchParams.get("product");

    const fetchInitialData = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", otherUserId)
          .single();
        setOtherUser(profile ? mapProfileToUser(profile as ProfileRow) : null);

        if (currentUser) {
          const { data: me } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();
          if (me) {
            setLoggedInProfile(mapProfileToUser(me as ProfileRow));
          } else {
            setLoggedInProfile({
              id: currentUser.id,
              name:
                (currentUser.user_metadata?.name as string) ||
                currentUser.email ||
                "Current User",
              avatarUrl:
                (currentUser.user_metadata?.avatar_url as string) ||
                `https://picsum.photos/seed/${currentUser.id}/100/100`,
              isVerified: false,
              role: "user",
            });
          }
        }

        if (productId && isUuid(productId)) {
          const { data: product } = await supabase
            .from("products")
            .select("*, profiles:seller_id(*)")
            .eq("id", productId)
            .single();
          if (product) {
            setRelatedProduct(mapProductRow(product as ProductRow));
          } else {
            setRelatedProduct(null);
          }
        } else {
          setRelatedProduct(null);
        }
      } catch (err) {
        console.error("Failed to fetch initial chat data:", err);
        setOtherUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [supabase, otherUserId, searchParams, currentUser, router, toast]);

  if (isSelfChat) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <h2>Can&apos;t message yourself</h2>
        <p style={{ color: "var(--muted)" }}>Choose a listing and message the seller.</p>
        <div style={{ marginTop: 16 }}>
          <Link className="btn btn-primary" href="/marketplace/products">
            Browse listings
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <h2>Loading chat…</h2>
      </div>
    );
  }

  if (!currentUser || !loggedInProfile) {
    const returnPath = `/marketplace/messages/${otherUserId}${
      searchParams.get("product") ? `?product=${searchParams.get("product")}` : ""
    }`;
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }} className="stack">
        <h2>Please log in</h2>
        <p style={{ color: "var(--muted)" }}>You need to be logged in to view messages.</p>
        <Link className="btn btn-primary" href={buildLoginUrl(returnPath)}>
          Log in to continue
        </Link>
      </div>
    );
  }

  if (!otherUser) {
    notFound();
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <h2 style={{ marginBottom: 4 }}>Chat with {otherUser.name}</h2>
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--muted)" }}>
        Agree on the deal in chat. Sellers can share their own bank or e-wallet QR here.
      </p>
      <ChatBox
        currentUser={loggedInProfile}
        otherUser={otherUser}
        relatedProduct={relatedProduct || undefined}
      />
    </div>
  );
}
