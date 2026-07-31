"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_KEYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const EVENT_COLORS: Record<CalendarEvent["event_type"], { bg: string; fg: string }> = {
  class: { bg: "var(--brand-soft)", fg: "var(--brand-deep)" },
  study: { bg: "var(--success-soft)", fg: "var(--success)" },
  task: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  personal: { bg: "#e8f0fd", fg: "#1d4ed8" },
};

const MAX_EVENTS_PER_DAY = 3;

type PlannerCalendarProps = {
  events: CalendarEvent[];
  month: Date;
  onMonthChange: (date: Date) => void;
  onDaySelect: (date: Date) => void;
  onEventSelect: (event: CalendarEvent) => void;
};

export function PlannerCalendar({ events, month, onMonthChange, onDaySelect, onEventSelect }: PlannerCalendarProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const today = new Date();

  const cells = useMemo(() => {
    const firstDay = new Date(year, monthIndex, 1);
    const leading = (firstDay.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return [
      ...Array.from({ length: leading }, () => null as number | null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [year, monthIndex]);

  const byDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const ev of events) {
      const d = new Date(ev.start_time);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        (map[d.getDate()] ??= []).push(ev);
      }
    }
    return map;
  }, [events, year, monthIndex]);

  function shiftMonth(delta: number) {
    onMonthChange(new Date(year, monthIndex + delta, 1));
  }

  function isToday(day: number) {
    return today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === day;
  }

  return (
    <div>
      <div className="planner-toolbar" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="small-action"
            type="button"
            onClick={() => shiftMonth(-1)}
            style={{ cursor: "pointer" }}
            aria-label="Previous month"
          >
            <Icon name="ti-chevron-left" />
          </button>
          <h3 style={{ margin: 0, fontSize: 18, minWidth: 150, textAlign: "center" }}>
            {MONTHS[monthIndex]} {year}
          </h3>
          <button
            className="small-action"
            type="button"
            onClick={() => shiftMonth(1)}
            style={{ cursor: "pointer" }}
            aria-label="Next month"
          >
            <Icon name="ti-chevron-right" />
          </button>
        </div>
        <button
          className="small-action"
          type="button"
          onClick={() => onMonthChange(new Date())}
          style={{ cursor: "pointer" }}
        >
          <Icon name="ti-calendar" /> Today
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <div className="calendar-weekday" key={w}>{w}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((day, i) => {
          if (day === null) return <div className="calendar-day empty" key={`blank-${i}`} />;
          const dayEvents = byDay[day] ?? [];
          const date = new Date(year, monthIndex, day);
          const visible = dayEvents.slice(0, MAX_EVENTS_PER_DAY);
          const extra = dayEvents.length - visible.length;

          return (
            <div
              className={`calendar-day ${isToday(day) ? "today" : ""}`}
              key={day}
              onClick={() => onDaySelect(date)}
            >
              <span className="calendar-day-num">{day}</span>
              {visible.map((ev) => {
                const color = EVENT_COLORS[ev.event_type];
                const start = new Date(ev.start_time);
                const time = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <button
                    type="button"
                    className="cal-event"
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventSelect(ev);
                    }}
                    style={{
                      background: color.bg,
                      color: color.fg,
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                    title={`${ev.title} · ${time}`}
                  >
                    {time} {ev.title}
                  </button>
                );
              })}
              {extra > 0 && <span className="cal-event more">+{extra} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function weekdayKeyOf(date: Date) {
  return WEEKDAY_KEYS[date.getDay()];
}
