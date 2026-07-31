"use client";

import type { CalendarEvent } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { EVENT_COLORS } from "./PlannerCalendar";

const TYPE_LABEL: Record<CalendarEvent["event_type"], string> = {
  class: "Class",
  study: "Study",
  task: "Task",
  personal: "Personal",
};

type EventListPanelProps = {
  events: CalendarEvent[];
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onNewEvent: () => void;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventListPanel({ events, onEdit, onDelete, onNewEvent }: EventListPanelProps) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="ti-calendar-event" /> Upcoming
        </h3>
        <button className="small-action" type="button" onClick={onNewEvent} style={{ cursor: "pointer" }}>
          <Icon name="ti-plus" /> New
        </button>
      </div>

      <div className="planner-list">
        {events.length === 0 && (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Nothing scheduled yet. Create your first event.</p>
        )}
        {events.map((ev) => {
          const color = EVENT_COLORS[ev.event_type];
          return (
            <div
              key={ev.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: 12,
              }}
            >
              <span style={{ width: 4, alignSelf: "stretch", borderRadius: 99, background: color.fg, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 14 }}>{ev.title}</strong>
                <span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 12 }}>{formatTime(ev.start_time)}</span>
                {ev.location && (
                  <span style={{ display: "block", marginTop: 2, color: "var(--muted)", fontSize: 12 }}>
                    <Icon name="ti-map-pin" /> {ev.location}
                  </span>
                )}
                <div style={{ marginTop: 6 }}>
                  <Badge tone={ev.event_type === "task" ? "warning" : ev.event_type === "study" ? "success" : "brand"}>
                    {TYPE_LABEL[ev.event_type]}
                  </Badge>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  className="small-action"
                  type="button"
                  onClick={() => onEdit(ev)}
                  aria-label="Edit"
                  style={{ cursor: "pointer", minHeight: 30, padding: "0 8px" }}
                >
                  <Icon name="ti-pencil" />
                </button>
                <button
                  className="small-action"
                  type="button"
                  onClick={() => onDelete(ev.id)}
                  aria-label="Delete"
                  style={{ cursor: "pointer", minHeight: 30, padding: "0 8px", background: "var(--warning-soft)", color: "var(--warning)" }}
                >
                  <Icon name="ti-trash" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
