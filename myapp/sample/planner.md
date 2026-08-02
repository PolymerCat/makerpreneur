# Implementation Strategy — Study Plan & Class Schedule

> Source: `./plan.md`
> Goal: a section where students manage their daily academic plans and schedule, integrated with Google Calendar, with in-app reminders.

---

## 1. Requirements Recap

| # | Use Case |
|---|---|
| 1 | Students can view a calendar for all events / class schedules |
| 2 | Events and class schedules also appear in their Google Calendar |
| 3 | Students can create weekly class times and view them on the calendar |
| 4 | Students can create events (study sessions, tasks) and view them on the calendar |
| 5 | Students get reminders for events and classes in the app |

### Derived requirements
- **Two-way sync** with Google Calendar (in-app events appear in Google, Google events appear in-app).
- **Recurring events** for weekly classes (RRULE).
- **In-app reminders** for upcoming events.

---

## 2. Architecture Decisions

### 2.1 Calendar data lives in Supabase, Google is a sync target
- Single source of truth: our own `calendar_events` table.
- Google Calendar is a mirror: push created events there, pull Google-created events back.
- Keeps the app usable even without Google OAuth (graceful degradation).

### 2.2 Google integration via OAuth 2.0 + Calendar API
- User authorizes once through Google's OAuth consent screen.
- We store the refresh token per user and call the Calendar API server-side with an admin/service-role Supabase client (same pattern already used for chat file access).
- Use the official `googleapis` npm package (server only — never expose tokens to the client).

### 2.3 Recurrence stored as RRULE
- Google Calendar's native recurrence format (`RRULE:FREQ=WEEKLY;BYDAY=MO,WE`).
- Syncs losslessly with Google and stays human-readable.
- In-app, we expand the recurring event into concrete instances for the visible week/month window (no full expansion stored in DB).

### 2.4 Reminders: client-side check + optional browser notifications
- A lightweight client interval checks for events starting within a configurable window (e.g. 30 min) and shows an in-app banner/toast.
- Progressive enhancement: Browser Notification API for background notifications (opt-in, permission-gated).
- A Supabase Edge Function cron can be added later for push/webhook delivery without changing client code.

### 2.5 Follow existing codebase conventions
- Reuse the **localStorage + Supabase dual-persistence** store pattern (`lib/subject-store.ts`).
- Reuse `AppShell`, `PageHero`, `Card`, `Badge`, `Icon`, `SectionHeader`, `MetricCard`.
- Client components only where interactivity is needed; server components for static composition.
- Types in `lib/types.ts`, seed data in `lib/sample-data.ts`.

---

## 3. Data Model

New file: `sample/sql-files/calendar-tables.sql`

```sql
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  title text not null,
  description text,
  location text,

  event_type text not null default 'study'
    check (event_type in ('class', 'study', 'task', 'personal')),

  start_time timestamptz not null,
  end_time timestamptz not null,

  -- Google recurrence rule, e.g. FREQ=WEEKLY;BYDAY=MO,WE
  rrule text,

  -- Set when pushed to Google (enables 2-way sync + updates)
  google_event_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.google_tokens (
  user_id uuid primary key
    references auth.users(id) on delete cascade,

  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  calendar_id text not null default 'primary',

  updated_at timestamptz not null default now()
);
```

### RLS policies
- `calendar_events`: users can CRUD only their own rows (`user_id = auth.uid()`).
- `google_tokens`: users can read/update only their own row. **Never selectable client-side** — tokens only readable by the server (service-role) API routes.

### Types (`lib/types.ts`)

```ts
export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  location: string;
  event_type: "class" | "study" | "task" | "personal";
  start_time: string; // ISO
  end_time: string;   // ISO
  rrule: string | null;
  google_event_id: string | null;
};

export type GoogleToken = {
  user_id: string;
  refresh_token: string;
  access_token: string | null;
  expires_at: string | null;
  calendar_id: string;
};
```

---

## 4. Google Calendar Integration

### 4.1 Setup steps (one-time)
1. Google Cloud Console → create project → enable **Google Calendar API**.
2. Configure OAuth consent screen → scopes:
   - `https://www.googleapis.com/auth/calendar` (full read/write)
   - `https://www.googleapis.com/auth/calendar.events`
3. Create OAuth Client ID (**Web application**) → add authorized redirect URI:
   `http://localhost:3000/api/oauth/google/callback`
4. Add env vars to `.env.local`:

```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4.2 Server-side flow

| Route | Purpose |
|---|---|
| `app/api/oauth/google/route.ts` | GET: build consent URL → redirect user to Google |
| `app/api/oauth/google/callback/route.ts` | GET: exchange `code` for tokens → store in `google_tokens` (service-role client) → redirect to `/calendar` |
| `app/api/google/sync/route.ts` | POST: push local events → Google, pull Google events → local |
| `app/api/google/status/route.ts` | GET: is the user connected to Google? (checks `google_tokens`) |

### 4.3 Sync strategy
- **Push**: on event create/update/delete, if the user has a token, mirror the change to Google via the Calendar API (`events.insert`, `events.update`, `events.delete`). Store returned `google_event_id`.
- **Pull**: on request, query Google for the visible window and upsert events that have no local match (or whose Google `etag`/`updated` is newer).
- Conflict handling (phase 2): last-write-wins based on `updated_at` timestamps.
- Offline-safe: Supabase remains the source of truth; Google sync is best-effort with errors logged.

---

## 5. Component Plan

All new components follow the existing `components/domain` and `components/ui` structure.

| Component | Type | Purpose |
|---|---|---|
| `components/domain/CalendarView.tsx` | Client | Month/week grid rendering events (recurring expanded in window) |
| `components/domain/EventForm.tsx` | Client | Create/edit event modal (title, type, times, recurrence, location, description) |
| `components/domain/EventListPanel.tsx` | Client | Sidebar list of upcoming events for the visible window |
| `components/domain/ReminderBanner.tsx` | Client | In-app reminder for events starting soon |
| `components/domain/GoogleConnectButton.tsx` | Client | "Connect Google Calendar" button + connected status badge |

**Pages**
| Route | Purpose |
|---|---|
| `app/study/page.tsx` | Hosts the new "Schedule" section (per plan item 1: "a section") |
| `app/calendar/page.tsx` | Optional dedicated full-page calendar (for phase 2 once Google sync + filters grow) |

### UI flow
```
[Study page] → "My Schedule" section
  ├── GoogleConnectButton (status: connected / connect)
  ├── ReminderBanner (shows if event ≤30min away)
  ├── CalendarView (month grid, click day → create event)
  └── EventListPanel (upcoming events, click → edit)
       └── EventForm (modal: create / edit / delete)
```

---

## 6. Store Layer

New file: `lib/calendar-store.ts`

```
getEvents(start, end)          → events in window (local + Supabase)
createEvent(input)             → insert + optional Google push
updateEvent(id, patch)         → update + optional Google sync
deleteEvent(id)                → delete + optional Google delete
getUpcomingEvents(withinMins)  → for reminders
```

- Mirrors `lib/subject-store.ts` exactly: localStorage-first, Supabase fire-and-forget sync, optional Supabase client param.
- A small `lib/recurrence.ts` helper expands an RRULE into concrete instances within a `[start, end]` window (using `rrule` npm package — tiny, no deps conflict).

---

## 7. Reminders

- `ReminderBanner` + a `useReminder` hook polls `getUpcomingEvents(30)` every 60s.
- First match is highlighted in a banner with a "Open" action.
- Browser Notification API: user toggles opt-in; when granted, `new Notification(title, { body })` on timer.
- Never spam: each event id is remembered in session state to avoid repeat notifications.

---

## 8. Implementation Phases

| Phase | Scope | Deliverable |
|---|---|---|
| **1. Core calendar** | SQL + RLS, types, store, CalendarView, EventForm, EventListPanel, study page section | Fully working local+Supabase calendar, recurring classes, reminders |
| **2. Google integration** | OAuth routes, token storage, googleapis sync, connect button | Two-way Google Calendar sync |
| **3. Polish** | Conflict handling, recurring-event Google sync, notifications opt-in, empty states | Production-ready |

---

## 9. Dependencies to Add

```
npm install googleapis rrule
```

- `googleapis` — Google Calendar API client (server-side only).
- `rrule` — RRULE parsing/expansion for recurring classes.

---

## 10. Testing & Verification

- `npx tsc --noEmit` — type safety.
- `npm run lint` — ESLint (repo already fails on `set-state-in-effect`; follow the existing lazy-init pattern to stay clean).
- `npm run build` — production build sanity check.
- Manual: create class (weekly) → verify expansion across weeks; create event → verify it appears in Google Calendar; edit/delete → verify sync; reminder banner fires within window.
