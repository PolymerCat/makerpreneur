"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/lib/auth-context";
import { Card } from "@/components/ui/Card";
import { mapNotificationRow, type NotificationRow } from "../_lib/mappers";
import type { Notification } from "@/lib/marketplace/types";
import { useToast } from "@/components/marketplace/use-toast";

export default function InboxPage() {
  const { user, supabase } = useSession();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching notifications: ", error);
      setIsLoading(false);
      return;
    }

    setNotifications((data as NotificationRow[] | null)?.map(mapNotificationRow) ?? []);
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadNotifications();
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, loadNotifications]);

  const handleConfirmTransaction = async (notification: Notification) => {
    if (!user || !notification.metadata?.buyerId || !notification.metadata?.purchaseId) return;

    try {
      const { error: purchaseError } = await supabase
        .from("purchases")
        .update({ status: "Successful" })
        .eq("id", notification.metadata.purchaseId);
      if (purchaseError) throw purchaseError;

      const { error: notifError } = await supabase
        .from("notifications")
        .update({ read: true, action_type: null })
        .eq("id", notification.id);
      if (notifError) throw notifError;

      toast({
        title: "Transaction Confirmed",
        description: "The buyer's purchase has been marked as successful.",
      });
    } catch (error) {
      console.error("Error confirming transaction:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not confirm the transaction.",
      });
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
      if (error) throw error;
      toast({ title: "Notification Deleted" });
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Your Inbox</h3>
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <h2>Please log in</h2>
        <p style={{ color: "var(--muted)" }}>You need to be logged in to view your inbox.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 18px", borderBottom: "2px solid var(--line)" }}>
          <h3 style={{ margin: 0 }}>Your Inbox</h3>
        </div>
        {notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "var(--muted)" }}>
            <i className="ti ti-bell" style={{ fontSize: 40 }} />
            <h3>No new notifications</h3>
            <p>Important updates and messages will appear here.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 8, padding: 14 }}>
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="card"
                style={{
                  padding: "12px 14px",
                  background: notif.read ? "var(--surface)" : "var(--brand-soft)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong>{notif.title}</strong>
                  <small style={{ color: "var(--muted)" }}>
                    {notif.date?.toDate ? formatDistanceToNow(notif.date.toDate()) : ""}
                  </small>
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 10px" }}>
                  {notif.message}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    {notif.actionType === "confirm_transaction" && !notif.read && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => handleConfirmTransaction(notif)}>
                        <i className="ti ti-check" /> Confirm Transaction
                      </button>
                    )}
                    {notif.actionUrl && notif.actionType !== "confirm_transaction" && (
                      <Link className="btn btn-sm" href={notif.actionUrl}>
                        View Details
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label="Delete notification"
                    onClick={() => handleDeleteNotification(notif.id)}
                  >
                    <i className="ti ti-trash" style={{ color: "var(--danger)" }} />
                  </button>
                </div>
              </div>
            ))}
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
