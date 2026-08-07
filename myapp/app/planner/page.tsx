"use client";

import { useMemo, useState, useEffect } from "react";
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
import { db } from "@/app/study/_lib/db";
import { useSession } from "@/lib/auth-context";
import { expandEvents } from "@/lib/planner-utils";

export default function PlannerPage() {
  const { user } = useSession();
  const userId = user?.id || "";

  const [baseEvents, setBaseEvents] = useState<CalendarEvent[]>(plannerEvents);
  const [month, setMonth] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CalendarEvent | null>(null);
  const [formDate, setFormDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  async function loadUserEvents() {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const data: CalendarEvent[] = await db.listAll("planner_events", { userId }, null);
      if (data && data.length > 0) {
        setBaseEvents(data);
      } else {
        // If user has no events yet, seed with sample events and save them for the user
        const seedEvents = plannerEvents.map((ev) => ({ ...ev, userId }));
        for (const se of seedEvents) {
          try {
            await db.insert("planner_events", {
              userId,
              title: se.title,
              description: se.description || "",
              location: se.location || "",
              event_type: se.event_type,
              start_time: se.start_time,
              end_time: se.end_time,
              rrule: se.rrule || null,
              google_event_id: se.google_event_id || null,
            });
          } catch (_e) {}
        }
        const fresh: CalendarEvent[] = await db.listAll("planner_events", { userId }, null);
        if (fresh && fresh.length > 0) setBaseEvents(fresh);
      }
    } catch (err) {
      console.error("[PLANNER] Failed to load user events:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadUserEvents();
  }, [userId]);

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

  async function handleSave(data: Omit<CalendarEvent, "id" | "google_event_id">) {
    if (!userId) return;

    if (editTarget) {
      // Extract original UUID in case editTarget.id has an expanded RRULE date suffix
      const realId = editTarget.id.split("-")[0];
      try {
        await db.update("planner_events", realId, {
          title: data.title,
          description: data.description || "",
          location: data.location || "",
          event_type: data.event_type,
          start_time: data.start_time,
          end_time: data.end_time,
          rrule: data.rrule || null,
        });
      } catch (err) {
        console.error("[PLANNER] update error:", err);
      }
    } else {
      try {
        await db.insert("planner_events", {
          userId,
          title: data.title,
          description: data.description || "",
          location: data.location || "",
          event_type: data.event_type,
          start_time: data.start_time,
          end_time: data.end_time,
          rrule: data.rrule || null,
          google_event_id: null,
        });
      } catch (err) {
        console.error("[PLANNER] insert error:", err);
      }
    }

    setShowForm(false);
    await loadUserEvents();
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    // Extract base UUID (if expanded instance id like uuid-2026-06-01)
    const baseId = id.length > 36 && id.indexOf("-") !== -1 ? id.substring(0, 36) : id;
    try {
      await db.delete("planner_events", baseId);
      await loadUserEvents();
    } catch (err) {
      console.error("[PLANNER] delete error:", err);
    }
  }

  return (
    <AppShell>
      <PageHero
        eyebrow="Planner"
        title="Study plan & schedule"
        description="A monthly calendar for classes, study sessions, and tasks. Google Calendar sync is on the way."
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
