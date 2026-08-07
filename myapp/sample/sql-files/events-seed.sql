-- events-seed.sql
-- Dummy data for the MyCSD events board prototype.
-- Run in the Supabase SQL editor after 0013/0014 migrations.
-- created_by / user_id are resolved to the first real auth user, so the data
-- shows up for that account. Swap the subquery for a hardcoded uuid if you want
-- a specific owner........

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

insert into public.events (
  created_by, name, organizer, category, starts_at, ends_at, location,
  points, fee, registration_deadline, description, form_fields, status,
  registered_count
) values

-- Past events (already happened: good for the "attended / points" demo))))
(
  (select id from auth.users order by created_at limit 1),
  'AI Career Day Kickoff',
  'Career Services',
  'Career',
  '2026-07-20T09:00:00+08:00',
  '2026-07-20T12:00:00+08:00',
  'Main Auditorium',
  5,
  'Free',
  '2026-07-18T23:59:00+08:00',
  'Opening keynote with industry partners, alumni panel, and a look at internship pipelines for the coming semester.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-matrix","label":"Matrix no.","required":true},{"id":"f-diet","label":"Dietary needs","required":false}]',
  'open',
  4
),
(
  (select id from auth.users order by created_at limit 1),
  'Introduction to Prompt Engineering',
  'Tech Club',
  'Technology',
  '2026-07-28T14:00:00+08:00',
  '2026-07-28T17:00:00+08:00',
  'Innovation Lab',
  3,
  'Free',
  '2026-07-27T23:59:00+08:00',
  'Hands-on workshop covering prompt patterns, token budgets, and when to use an LLM vs a rules engine.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-skill","label":"Experience level","required":false}]',
  'open',
  2
),
(
  (select id from auth.users order by created_at limit 1),
  'Penang Coastal Clean-up',
  'Green Society',
  'Volunteer',
  '2026-08-02T08:00:00+08:00',
  '2026-08-02T12:00:00+08:00',
  'Batu Ferringhi Beach',
  12,
  'Free',
  '2026-08-01T12:00:00+08:00',
  'Saturday morning beach clean-up. Gloves and trash bags provided; wear closed-toe shoes and sunscreen.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-shirt","label":"T-shirt size","required":true}]',
  'open',
  1
),

-- Upcoming open events
(
  (select id from auth.users order by created_at limit 1),
  'FinTech Startup Networking Night',
  'Career Services',
  'Career',
  '2026-08-20T18:00:00+08:00',
  '2026-08-20T21:00:00+08:00',
  'City Bay Convention Centre',
  4,
  'RM 10 (refreshments included)',
  '2026-08-18T23:59:00+08:00',
  'Mix and mingle with founders, investors, and hiring managers from local fintech startups. Bring your resume and an elevator pitch.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-year","label":"Year of study","required":true},{"id":"f-cv","label":"Link to resume","required":false}]',
  'open',
  15
),
(
  (select id from auth.users order by created_at limit 1),
  'AI in Healthcare Hackathon',
  'Tech Club',
  'Technology',
  '2026-08-27T09:00:00+08:00',
  '2026-08-28T18:00:00+08:00',
  'Innovation Lab',
  8,
  'Free',
  '2026-08-24T23:59:00+08:00',
  '48-hour hackathon building AI prototypes for medical imaging and diagnostics. Teams of 2–4. Prizes for best clinical impact.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-team","label":"Team name","required":false}]',
  'open',
  0
),
(
  (select id from auth.users order by created_at limit 1),
  'Dosimetry Masterclass',
  'Physics Society',
  'Academic',
  '2026-09-03T15:00:00+08:00',
  '2026-09-03T17:30:00+08:00',
  'Lab F, Level 3',
  6,
  'Free',
  '2026-09-01T23:59:00+08:00',
  'Advanced session on treatment planning QA and TPS commissioning, led by a consultant medical physicist. Limited seats.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-matrix","label":"Matrix no.","required":true}]',
  'open',
  7
),
(
  (select id from auth.users order by created_at limit 1),
  'Friday Night Board Games',
  'Student Union',
  'Social',
  '2026-08-15T19:00:00+08:00',
  '2026-08-15T23:00:00+08:00',
  'Student Lounge, Block B',
  1,
  'Free',
  '2026-08-15T17:00:00+08:00',
  'Casual games night — Catan, Codenames, Uno, and a mystery board-game tournament with a small prize.',
  '[{"id":"f-name","label":"Full name","required":true}]',
  'open',
  9
),
(
  (select id from auth.users order by created_at limit 1),
  'Inter-Faculty Football League',
  'Sports Club',
  'Sports',
  '2026-08-30T16:00:00+08:00',
  '2026-08-30T18:30:00+08:00',
  'Football Field 1',
  3,
  'Free',
  '2026-08-28T23:59:00+08:00',
  'Kickoff match of the semester league. Register to play or come support your faculty.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-role","label":"Player or supporter","required":true},{"id":"f-shirt","label":"T-shirt size","required":false}]',
  'open',
  22
),
(
  (select id from auth.users order by created_at limit 1),
  'Library Workshop: Research Databases',
  'Academic Services',
  'Academic',
  '2026-08-21T11:00:00+08:00',
  '2026-08-21T12:30:00+08:00',
  'Library L2 Training Room',
  2,
  'Free',
  '2026-08-20T23:59:00+08:00',
  'Learn to navigate Scopus, IEEE, and the library''s journal portal — plus citation tools for your final-year project.',
  '[{"id":"f-name","label":"Full name","required":true}]',
  'open',
  5
),
(
  (select id from auth.users order by created_at limit 1),
  'Latte Art Throwdown',
  'Brew Crew',
  'Social',
  '2026-09-12T10:00:00+08:00',
  '2026-09-12T13:00:00+08:00',
  'Campus Café',
  2,
  'RM 15',
  '2026-09-10T23:59:00+08:00',
  'Barista skills competition. All skill levels welcome; judges rate symmetry, creativity, and taste.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-level","label":"Skill level","required":false}]',
  'open',
  3
),

-- Cancelled event (shows the cancelled badge / soft-delete flow)
(
  (select id from auth.users order by created_at limit 1),
  'Sunset Kayaking Trip',
  'Outdoor Club',
  'Sports',
  '2026-09-05T16:30:00+08:00',
  '2026-09-05T19:00:00+08:00',
  'Teluk Bahang Jetty',
  7,
  'RM 25',
  '2026-09-03T23:59:00+08:00',
  'Postponed to next semester due to monsoon season. Refunds processed within 7 days.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-pdf","label":"Parental consent form","required":true}]',
  'cancelled',
  12
);

-- ---------------------------------------------------------------------------
-- Registrations for the demo user (to populate "My registrations" + points)
-- ---------------------------------------------------------------------------

insert into public.event_registrations (event_id, user_id, answers, status, created_at, updated_at)
select e.id, (select id from auth.users order by created_at limit 1), '{"f-name":"Demo Student","f-matrix":"DEMO-001"}', 'attended', e.created_at, now()
from public.events e
where e.name in ('AI Career Day Kickoff', 'Penang Coastal Clean-up');

insert into public.event_registrations (event_id, user_id, answers, status, created_at, updated_at)
select e.id, (select id from auth.users order by created_at limit 1), '{"f-name":"Demo Student","f-matrix":"DEMO-001"}', 'no_show', e.created_at, now()
from public.events e
where e.name = 'Introduction to Prompt Engineering';

insert into public.event_registrations (event_id, user_id, answers, status, created_at, updated_at)
select e.id, (select id from auth.users order by created_at limit 1), '{"f-name":"Demo Student","f-matrix":"DEMO-001"}', 'registered', now(), now()
from public.events e
where e.name in ('FinTech Startup Networking Night', 'Dosimetry Masterclass', 'Friday Night Board Games');

-- ---------------------------------------------------------------------------
-- Demo user organizes one event themselves (fills the "My events" panel)
-- ---------------------------------------------------------------------------

insert into public.events (
  created_by, name, organizer, category, starts_at, ends_at, location,
  points, fee, registration_deadline, description, form_fields, status,
  registered_count
)
values (
  (select id from auth.users order by created_at limit 1),
  'Study Skills Bootcamp',
  'Demo Student',
  'Academic',
  '2026-08-25T10:00:00+08:00',
  '2026-08-25T13:00:00+08:00',
  'Library L2 Seminar Room',
  4,
  'Free',
  '2026-08-23T23:59:00+08:00',
  'Spaced repetition, active recall, and exam strategy for the mid-semester test season.',
  '[{"id":"f-name","label":"Full name","required":true},{"id":"f-matrix","label":"Matrix no.","required":true}]',
  'open',
  6
);
