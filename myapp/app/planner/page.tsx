"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { PlannerCalendar } from "@/components/domain/PlannerCalendar";
import { EventForm } from "@/components/domain/EventForm";
import { EventListPanel } from "@/components/domain/EventListPanel";
import { ReminderBanner } from "@/components/domain/ReminderBanner";
import { GoogleConnectButton } from "@/components/domain/GoogleConnectButton";
import { plannerEvents } from "@/lib/sample-data";
import type { CalendarEvent } from "@/lib/types";

const WEEKDAY_KEYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// Expand recurring (RRULE) events into concrete instances inside the visible month.
function expandEvents(base: CalendarEvent[], month: Date): CalendarEvent[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);
  const out: CalendarEvent[] = [];

  for (const ev of base) {
    if (!ev.rrule) {
      const d = new Date(ev.start_time);
      if (d >= monthStart && d <= monthEnd) out.push(ev);
      continue;
    }

    const days = ev.rrule.split(":")[1].split(",").map((s) => s.trim().toUpperCase());
    const start = new Date(ev.start_time);
    const durationMs = new Date(ev.end_time).getTime() - start.getTime();
    const iter = new Date(start);

    while (iter <= monthEnd) {
      if (days.includes(WEEKDAY_KEYS[iter.getDay()]) && iter >= monthStart) {
        const instanceStart = new Date(iter);
        out.push({
          ...ev,
          id: `${ev.id}-${iter.toISOString().slice(0, 10)}`,
          start_time: instanceStart.toISOString(),
          end_time: new Date(instanceStart.getTime() + durationMs).toISOString(),
        });
      }
      iter.setDate(iter.getDate() + 1);
    }
  }

  return out.sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export default function PlannerPage() {
  const [baseEvents, setBaseEvents] = useState<CalendarEvent[]>(plannerEvents);
  const [month, setMonth] = useState(() => new Date(2026, 5, 1));
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CalendarEvent | null>(null);
  const [formDate, setFormDate] = useState<Date | undefined>(undefined);

  const monthEvents = useMemo(() => expandEvents(baseEvents, month), [baseEvents, month]);
  const reminderEvent = monthEvents.find((ev) => ev.event_type === "class" || ev.event_type === "study") ?? monthEvents[0] ?? null;

  function openCreate(date?: Date) {
    setEditTarget(null);
    setFormDate(date);
    setShowForm(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditTarget(event);
    setShowForm(true);
  }

  function handleSave(data: Omit<CalendarEvent, "id" | "google_event_id">) {
    if (editTarget) {
      setBaseEvents((prev) => prev.map((ev) => (ev.id === editTarget.id ? { ...ev, ...data } : ev)));
    } else {
      setBaseEvents((prev) => [...prev, { ...data, id: crypto.randomUUID(), google_event_id: null }]);
    }
    setShowForm(false);
  }

  function handleDelete(id: string) {
    setBaseEvents((prev) => prev.filter((ev) => ev.id !== id));
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Planner"
        title="Study plan & schedule"
        description="A monthly calendar for classes, study sessions, and tasks — with Google Calendar sync on the way."
        icon="ti-calendar"
      />

      <div className="planner-toolbar">
        <GoogleConnectButton />
        <ReminderBanner event={reminderEvent} onOpen={() => reminderEvent && openEdit(reminderEvent)} />
      </div>

      <section className="two-column">
        <Card style={{ padding: 18 }}>
          <PlannerCalendar
            events={monthEvents}
            month={month}
            onMonthChange={setMonth}
            onDaySelect={openCreate}
            onEventSelect={openEdit}
          />
        </Card>
        <EventListPanel
          events={monthEvents.slice(0, 8)}
          onEdit={openEdit}
          onDelete={handleDelete}
          onNewEvent={() => openCreate()}
        />
      </section>

      {showForm && (
        <EventForm
          initial={editTarget}
          defaultDate={formDate}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </AppShell>
  );
}
