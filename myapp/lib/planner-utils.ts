import type { CalendarEvent } from "@/lib/types";

const WEEKDAY_KEYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function expandEvents(base: CalendarEvent[], month: Date): CalendarEvent[] {
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

    let cur = new Date(year, monthIndex, 1);
    while (cur.getMonth() === monthIndex) {
      const key = WEEKDAY_KEYS[cur.getDay()];
      if (days.includes(key)) {
        const evStart = new Date(year, monthIndex, cur.getDate(), start.getHours(), start.getMinutes());
        const evEnd = new Date(evStart.getTime() + durationMs);
        out.push({
          ...ev,
          id: `${ev.id}-${evStart.toISOString().slice(0, 10)}`,
          start_time: evStart.toISOString(),
          end_time: evEnd.toISOString(),
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return out;
}
