"use client";

import type { CalendarEvent } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

type ReminderBannerProps = {
  event: CalendarEvent | null;
  onOpen: () => void;
};

export function ReminderBanner({ event, onOpen }: ReminderBannerProps) {
  if (!event) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: "1px solid var(--warning-soft)",
        borderRadius: "var(--radius)",
        background: "var(--warning-soft)",
        color: "var(--warning)",
        padding: "12px 16px",
        marginBottom: 16,
      }}
    >
      <Icon name="ti-alarm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 14 }}>Up next: {event.title}</strong>
        <span style={{ display: "block", marginTop: 2, fontSize: 12, opacity: 0.85 }}>
          {new Date(event.start_time).toLocaleString([], {
            weekday: "long",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </div>
      <button className="small-action" type="button" onClick={onOpen} style={{ cursor: "pointer" }}>
        <Icon name="ti-chevron-right" /> Open
      </button>
    </div>
  );
}
