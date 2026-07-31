"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { weekdayKeyOf } from "./PlannerCalendar";

type EventInput = Omit<CalendarEvent, "id" | "google_event_id">;

type EventFormProps = {
  initial?: CalendarEvent | null;
  defaultDate?: Date;
  onSave: (data: EventInput) => void;
  onClose: () => void;
};

function toDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInput(date: Date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function EventForm({ initial, defaultDate, onSave, onClose }: EventFormProps) {
  const base = initial ?? null;
  const baseDate = base ? new Date(base.start_time) : defaultDate ?? new Date();

  const [title, setTitle] = useState(base?.title ?? "");
  const [eventType, setEventType] = useState<CalendarEvent["event_type"]>(base?.event_type ?? "study");
  const [date, setDate] = useState(toDateInput(baseDate));
  const [start, setStart] = useState(base ? toTimeInput(baseDate) : "09:00");
  const [end, setEnd] = useState(base ? toTimeInput(new Date(base.end_time)) : "10:00");
  const [repeat, setRepeat] = useState<string>(base?.rrule === null || !base?.rrule ? "never" : "weekly");
  const [location, setLocation] = useState(base?.location ?? "");
  const [description, setDescription] = useState(base?.description ?? "");

  function buildRrule(): string | null {
    if (repeat === "never") return null;
    if (repeat === "weekdays") return "WEEKLY:MO,TU,WE,TH,FR";
    return `WEEKLY:${weekdayKeyOf(new Date(`${date}T${start}`))}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      event_type: eventType,
      start_time: new Date(`${date}T${start}`).toISOString(),
      end_time: new Date(`${date}T${end}`).toISOString(),
      rrule: buildRrule(),
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <Card className="modal" style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name={base ? "ti-edit" : "ti-calendar-plus"} />
            {base ? "Edit event" : "New event"}
          </h3>
          <button className="small-action" type="button" onClick={onClose} aria-label="Close" style={{ cursor: "pointer" }}>
            <Icon name="ti-x" />
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Study group" required autoFocus />
          </label>

          <label>
            Type
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CalendarEvent["event_type"])}
              style={selectStyle}
            >
              <option value="class">Class</option>
              <option value="study">Study session</option>
              <option value="task">Task</option>
              <option value="personal">Personal</option>
            </select>
          </label>

          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>

          <div className="form-row">
            <label>
              Start
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label>
              End
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
          </div>

          <label>
            Repeats
            <select value={repeat} onChange={(e) => setRepeat(e.target.value)} style={selectStyle}>
              <option value="never">Never</option>
              <option value="weekly">Every week</option>
              <option value="weekdays">Every weekday</option>
            </select>
          </label>

          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Library L2" />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
              rows={3}
              style={textareaStyle}
            />
          </label>

          <div className="form-actions">
            <button className="secondary-button" type="submit" style={{ border: 0, cursor: "pointer" }}>
              <Icon name="ti-device-floppy" /> {base ? "Update" : "Create event"}
            </button>
            <button className="small-action" type="button" onClick={onClose} style={{ cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  marginTop: 7,
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 12px",
  fontSize: 14,
  background: "var(--surface)",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 7,
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: 11,
  fontFamily: "inherit",
  fontSize: 14,
  resize: "vertical",
};
