"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/lib/auth-context";
import { Card } from "@/components/ui/Card";

type Chat = {
  id: string;
  users: string[];
  lastMessage: string;
  lastUpdated: Date | null;
  participants: { [key: string]: { name: string; avatarUrl: string } };
};

export default function MessagesPage() {
  const { user: currentUser, supabase } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadChats = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      setChats([]);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .contains("users", [currentUser.id]);

    if (error) {
      console.error("Error fetching chats: ", error);
      setIsLoading(false);
      return;
    }

    const fetchedChats: Chat[] = (data ?? []).map((row) => ({
      id: row.id,
      users: row.users,
      lastMessage: row.last_message,
      lastUpdated: row.last_updated ? new Date(row.last_updated) : null,
      participants: row.participants ?? {},
    }));

    fetchedChats.sort((a, b) => {
      const dateA = a.lastUpdated?.getTime() ?? 0;
      const dateB = b.lastUpdated?.getTime() ?? 0;
      return dateB - dateA;
    });

    setChats(fetchedChats);
    setIsLoading(false);
  }, [currentUser, supabase]);

  useEffect(() => {
    loadChats();
    if (!currentUser) return;

    const channel = supabase
      .channel(`chats:${currentUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () =>
        loadChats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, supabase, loadChats]);

  if (isLoading) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Your Conversations</h3>
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        </Card>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <h2>Please log in</h2>
        <p style={{ color: "var(--muted)" }}>You need to be logged in to view your messages.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 18px", borderBottom: "2px solid var(--line)" }}>
          <h3 style={{ margin: 0 }}>Your Conversations</h3>
        </div>
        {chats.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "var(--muted)" }}>
            <i className="ti ti-message-circle" style={{ fontSize: 40 }} />
            <h3>No messages yet</h3>
            <p>Start a conversation by contacting a seller on a product page.</p>
          </div>
        ) : (
          <div>
            {chats.map((chat) => {
              const otherUserId = chat.users.find((id) => id !== currentUser.id);
              if (!otherUserId || !chat.participants || !chat.participants[otherUserId]) return null;

              const otherParticipant = chat.participants[otherUserId];

              return (
                <Link key={chat.id} href={`/marketplace/messages/${otherUserId}`} className="conv-row">
                  <span className="avatar">{otherParticipant.name.charAt(0)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{otherParticipant.name}</strong>
                    <p>{chat.lastMessage}</p>
                  </div>
                  <div className="conv-meta">
                    {chat.lastUpdated
                      ? formatDistanceToNow(chat.lastUpdated)
                      : ""}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function formatDistanceToNow(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
