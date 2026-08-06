"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { User, Product, Message } from "@/lib/marketplace/types";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth-context";
import { uploadImage, mapMessageRow, type MessageRow } from "@/app/marketplace/_lib/mappers";
import { useToast } from "./use-toast";
import { MEETUP_SPOTS, applyMeetupDraft, type MeetupSpot } from "@/lib/marketplace/meetup-spots";
import { ChatDealPanel } from "./ChatDealPanel";

type ChatBoxProps = {
  currentUser: User;
  otherUser: User;
  relatedProduct?: Product;
};

export function ChatBox({ currentUser, otherUser, relatedProduct }: ChatBoxProps) {
  const { supabase } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [product, setProduct] = useState<Product | undefined>(relatedProduct);
  const [newMessage, setNewMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const chatId = [currentUser.id, otherUser.id].sort().join("_");
  const isSellerOfProduct = !!product && product.seller.id === currentUser.id;

  useEffect(() => {
    setProduct(relatedProduct);
  }, [relatedProduct]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("mp_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: true });
    if (error) {
      console.error("Error fetching messages: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load chat messages.",
      });
      return;
    }
    setMessages((data as MessageRow[] | null)?.map(mapMessageRow) ?? []);
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mp_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sendChatMessage = async (text: string, imageUrl?: string) => {
    const messageText = text.trim();
    if (!messageText && !imageUrl) return;

    const lastMessage = imageUrl
      ? (messageText ? `${messageText} (Image)` : "Image")
      : messageText;

    const { error: chatError } = await supabase.from("chats").upsert({
      id: chatId,
      users: [currentUser.id, otherUser.id],
      last_message: lastMessage,
      last_updated: new Date().toISOString(),
      participants: {
        [currentUser.id]: { name: currentUser.name, avatarUrl: currentUser.avatarUrl },
        [otherUser.id]: { name: otherUser.name, avatarUrl: otherUser.avatarUrl },
      },
    });
    if (chatError) throw chatError;

    const { error: msgError } = await supabase.from("mp_messages").insert({
      chat_id: chatId,
      sender_id: currentUser.id,
      text: messageText || null,
      image_url: imageUrl || null,
    });
    if (msgError) throw msgError;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" && !imageFile) return;

    setIsSending(true);

    try {
      let imageUrl: string | undefined = undefined;

      if (imageFile) {
        imageUrl = await uploadImage(supabase, imageFile);
      }

      await sendChatMessage(newMessage, imageUrl);
      setNewMessage("");
      removeImage();
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Error Sending Message",
        description: error?.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleShareQr = async () => {
    if (!currentUser.qrCodeUrl) {
      toast({
        variant: "destructive",
        title: "No payment QR yet",
        description: "Add your QR in Profile → Edit, then share it here.",
      });
      return;
    }

    setIsSending(true);
    try {
      const productHint = product
        ? ` for "${product.name}" (RM ${product.price.toFixed(2)})`
        : "";
      const noteHint = currentUser.paymentNote
        ? ` Payment note: ${currentUser.paymentNote}`
        : "";
      await sendChatMessage(
        `Here is my payment QR${productHint}.${noteHint} Please transfer directly — marketplace does not process payments.`,
        currentUser.qrCodeUrl
      );
      toast({
        title: "QR shared",
        description: "Your payment QR was sent in this chat.",
      });
    } catch (error: any) {
      console.error("Error sharing QR:", error);
      toast({
        variant: "destructive",
        title: "Could not share QR",
        description: error?.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleMeetupChip = (spot: MeetupSpot) => {
    if (spot.focusOnly) {
      setNewMessage((prev) => {
        if (prev.trim()) return prev;
        return spot.draft;
      });
      requestAnimationFrame(() => messageInputRef.current?.focus());
      return;
    }
    setNewMessage((prev) => applyMeetupDraft(prev, spot.draft));
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  return (
    <Card style={{ height: "70vh", display: "flex", flexDirection: "column", padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "2px solid var(--line)" }}>
        <span className="avatar">{otherUser.name.charAt(0)}</span>
        <div>
          <strong>{otherUser.name}</strong>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Arrange the deal here — payment is direct between students.
          </p>
        </div>
      </div>

      {product && (
        <div style={{ padding: "10px 14px", borderBottom: "2px solid var(--line)" }} className="stack">
          <Link href={`/marketplace/products/${product.id}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {product.imageUrls[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrls[0]} alt={product.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
            )}
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{product.name}</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--brand-deep)" }}>
                RM {product.price.toFixed(2)}
              </p>
            </div>
          </Link>

          <ChatDealPanel
            currentUser={currentUser}
            otherUser={otherUser}
            product={product}
            chatId={chatId}
            onProductChange={setProduct}
          />

          {isSellerOfProduct && (
            <div className="stack">
              <button type="button" className="btn btn-sm btn-secondary" onClick={handleShareQr} disabled={isSending}>
                <i className="ti ti-qrcode" /> Share my payment QR
              </button>
              {!currentUser.qrCodeUrl && (
                <Link href="/marketplace/profile/edit" style={{ fontSize: 13, color: "var(--brand)", fontWeight: 700 }}>
                  Add payment QR in Profile → Edit
                </Link>
              )}
            </div>
          )}
          {!isSellerOfProduct && (
            <p style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>
              Ask the seller about availability, meetup spot, and how to pay (their bank/QR).
            </p>
          )}
          <div className="stack" style={{ gap: 6 }}>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
              Prefer public campus spots.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MEETUP_SPOTS.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handleMeetupChip(spot)}
                  disabled={isSending}
                >
                  {spot.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="chat-thread" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.map((msg) => {
          const mine = msg.senderId === currentUser.id;
          return (
            <div key={msg.id} className={mine ? "chat-bubble chat-bubble-mine" : "chat-bubble chat-bubble-other"}>
              {msg.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.imageUrl}
                  alt="Chat image"
                  style={{ maxWidth: 200, borderRadius: 8, marginBottom: 6, cursor: "pointer" }}
                  onClick={() => window.open(msg.imageUrl, "_blank")}
                />
              )}
              {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
              <small>
                {msg.timestamp?.toDate
                  ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : ""}
              </small>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: 12, borderTop: "2px solid var(--line)" }} className="stack">
        {imagePreview && (
          <div style={{ position: "relative", width: 88, height: 88 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Image preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
            <button
              type="button"
              onClick={removeImage}
              aria-label="Remove image"
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                background: "var(--danger)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 22,
                height: 22,
                cursor: "pointer",
              }}
            >
              <i className="ti ti-x" />
            </button>
          </div>
        )}
        <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="file" ref={fileInputRef} onChange={handleImageChange} style={{ display: "none" }} accept="image/*" />
          <button type="button" className="btn btn-sm" onClick={() => fileInputRef.current?.click()} disabled={isSending} aria-label="Attach image">
            <i className="ti ti-photo-plus" />
          </button>
          <input
            ref={messageInputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isSellerOfProduct ? "Reply about meetup or payment…" : "Ask about buying this item…"}
            autoComplete="off"
            disabled={isSending}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={isSending || (!newMessage.trim() && !imageFile)}>
            <i className="ti ti-send" />
          </button>
        </form>
      </div>
    </Card>
  );
}
