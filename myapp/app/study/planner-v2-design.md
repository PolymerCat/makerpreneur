# Planner V2 — Design Spec

## Overview

Replace the shallow `/study/planner` (manual weekly grid) and `/study/path` (single-exam linear plan) with a **Unified Planner** at `/study/planner`. Input all exams for a subject, and the system estimates the syllabus to cover and generates a personalized, spacing-aware study plan.

## Structure

- **`/study/planner`** — unified page (exams register + plan view + day list).
- **`/study/path`** — redirects to `/study/planner`.
- The existing planner page (`app/study/planner/page.tsx`) is replaced entirely. The path page (`app/study/path/page.tsx`) becomes a redirect.

## Inputs

### 1. Exams Register
A table of exams the user has this term/semester:

| Field | Type | Notes |
|-------|------|-------|
| Subject | string (course.subject) | selected from active course |
| Exam date | date | required |
| Weight (%) | number 0–100 | optional, defaults to equal |
| Scope | enum: `full` / `partial` | full = entire syllabus; partial = selected topics |
| Target grade | string (A–F or 1–5) | optional |

Add/edit/delete exams inline. Archived exams are hidden but preserved.

### 2. Topic Difficulty (per subject)
Each subject has a list of canonical topics. User rates each 1–10 (1 = easy, 10 = hard). Sources for topics (in order):

1. LLM extracts from `materials` titles + `chunks` text + `predictions.questions_json[].topic` — persisted to a `topics` table.
2. Chat memories (`memories` with `importance`) — auto-seed difficulty (high importance → higher default difficulty).
3. User manual rating overrides.

### 3. Capacity & Constraints (`study_settings`)
Per-user settings stored in a `study_settings` row:

| Field | Type | Default |
|-------|------|---------|
| weekday_hours | int | 3 |
| weekend_hours | int | 5 |
| blackout_dates | jsonb `string[]` | `[]` |
| session_minutes | int | 50 |

## Scheduling Engine (Hybrid)

### Phase 1 — LLM Sequencer (`aiBuildTopicSequence`)
One LLM call per subject that needs planning. Prompt includes:
- Subject name + exam date + weight + scope + target grade
- Topic list with user-rated difficulties
- Available days between now and exam date (computed by TS scheduler)
- Cluster rule: if another exam for the same subject is within W days, start W + buffer days early

LLM returns an ordered list of topics with estimated hours each:
```json
{ "subject": "Math", "topics": [
  {"topic": "Calculus", "hours": 4, "day": -10},
  {"topic": "Linear Algebra", "hours": 3, "day": -7}
]}
```

### Phase 2 — TS Scheduler (`schedulePlan`)
Maps the LLM sequence onto actual calendar days:

1. Compute available days per subject (capacity - classes - blackout - already-done).
2. **Consecutive exam cluster**: if 2+ exams for the same subject within W days (configurable, default 3), allocate study starting `W + 1` days before the first exam, interleaving subjects.
3. **Spaced exams**: sequential single-subject deep dives, one subject per day block.
4. **Revision buffer**: last 1–2 days before each exam = review + mock (reuses `generated_exams` flow for mock tasks).
5. Write `plan_days` rows with `topic_id`, `estimated_minutes`, `block_kind` (`study` | `review` | `mock`).

### Live Re-planning
- **Toggle done**: instant TS recompute — shifts remaining topics forward/backward to fill the gap.
- **"Re-flow" button**: TS-only recompute, preserves done days.
- **"Regenerate" button**: full LLM + TS recompute.
- **Archive exam**: re-flows the rest of the plan.

## Schema Additions

### `exams`
```sql
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade not null,
  title text not null default '',
  exam_date text not null,
  weight int not null default 100,
  scope text not null default 'full' check (scope in ('full', 'partial')),
  target_grade text,
  archived boolean not null default false,
  created_at timestamptz default now()
);
```

### `topics`
```sql
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade not null,
  name text not null,
  source text not null default 'auto',  -- 'auto' | 'manual' | 'memory'
  source_ref text,                       -- chunk id or memory id
  display_order int not null default 0,
  difficulty int,                        -- 1–10, null = unrated
  archived boolean not null default false,
  created_at timestamptz default now()
);
```

### `study_settings`
```sql
create table public.study_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekday_hours int not null default 3,
  weekend_hours int not null default 5,
  blackout_dates jsonb not null default '[]',
  session_minutes int not null default 50
);
```

### Extend `plan_days`
```sql
alter table public.plan_days add column exam_id uuid references public.exams(id) on delete set null;
alter table public.plan_days add column topic_id uuid references public.topics(id) on delete set null;
alter table public.plan_days add column estimated_minutes int not null default 50;
alter table public.plan_days add column block_kind text not null default 'study' check (block_kind in ('study', 'review', 'mock'));
```

### Extend `study_plans`
```sql
alter table public.study_plans add column settings_snapshot jsonb not null default '{}';
alter table public.study_plans add column subject_id uuid references public.subjects(id) on delete set null;
```

## RLS
- `exams`: owner-scoped via `subject_id → subjects.created_by = auth.uid()` (chain from 0009).
- `topics`: same subject ownership chain.
- `study_settings`: `user_id = auth.uid()`.
- `plan_days` / `study_plans`: inherit from existing patterns (via course/subject ownership).

No new migration RLS policies needed — existing owner-scoped policies cover these chains.

## Existing Assets Reused
- `predictions.questions_json[].topic` + `studied_ids` — topic source + studied tracking.
- `memories` (importance field) — auto-seed topic difficulty.
- `materials` / `chunks` — LLM topic extraction source.
- `generated_exams` flow — mock exam tasks in revision buffer.
- `schedule_blocks` — manual overlay (kept, not replaced).
- `aiMakeStudyPath` action — replaced by `aiBuildTopicSequence` (new action).

## Out of Scope (V1)
- Full spaced-repetition algorithm (SRS/FSRS).
- Drag-and-drop auto time blocks.
- Cross-subject load balancing.
- Notifications/reminders.
- Prerequisite topic graph.

## UI Layout (Unified Planner)

Three-column layout within the planner page:

1. **Left panel (240px)**: Exams register table — add/edit/delete inline. Archive button per exam.
2. **Center**: Plan view — week grid (like current planner) but with plan_days rendered as topic blocks colored by block_kind (study=blue, review=amber, mock=red). Click a day block to see topic details + link to matching material.
3. **Right panel (260px)**: Topic list with difficulty ratings (1–10 stars), edit inline. "Re-flow" and "Regenerate" buttons at top.

Mobile: stacked vertically — exams register on top, plan grid middle, topic list bottom.
