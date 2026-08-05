import type { CalendarEvent, CampusEvent, FeedItem, Metric, NavItem, Person, Resource, Subject, Task } from "./types";

// Temporary seed data. Later, replace these exports with Supabase queries that return the same shapes.
export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: "ti-home" },
  { href: "/community", label: "Community", icon: "ti-users" },
  { href: "/study", label: "Study", icon: "ti-school" },
  { href: "/events", label: "MyCSD", icon: "ti-confetti" },
  { href: "/campus", label: "Campus", icon: "ti-building" },
  { href: "/profile", label: "Profile", icon: "ti-user" },
  { href: "/planner", label: "Planner", icon: "ti-calendar" },
  { href: "/repository", label: "Exam Paper Repository", icon: "ti-files" },
];

export const dashboardMetrics: Metric[] = [
  { label: "MyCSD points", value: "420", icon: "ti-trophy", helper: "42% to yearly target" },
  { label: "Wallet coins", value: "850", icon: "ti-coin", helper: "Redeemable on campus" },
  { label: "Study streak", value: "15", icon: "ti-flame", helper: "Days in a row" },
  { label: "Events joined", value: "12", icon: "ti-confetti", helper: "This semester" },
];

export const tasks: Task[] = [
  { id: "task-1", title: "FIN345 Assignment", due: "Due tomorrow", status: "Urgent", priority: "high" },
  { id: "task-2", title: "Software Testing Tutorial", due: "Today at 10:00 AM", status: "Next class", priority: "medium" },
  { id: "task-3", title: "Lab Report", due: "Due in 3 days", status: "Drafting", priority: "low" },
];

export const events: CampusEvent[] = [
  { id: "event-1", name: "Career Talk", date: "20 June 2026", time: "2:00 PM", location: "DK A", points: 2, category: "Career" },
  { id: "event-2", name: "AI Workshop", date: "20 June 2026", time: "4:00 PM", location: "Innovation Lab", points: 3, category: "Technology" },
  { id: "event-3", name: "Beach Clean-up", date: "5 July 2026", time: "8:00 AM", location: "Batu Ferringhi", points: 12, category: "Volunteer" },
];

export const feedItems: FeedItem[] = [
  { id: "feed-1", title: "AI Workshop starts soon", body: "Registration closes tonight for the 4:00 PM lab session.", tag: "Event", icon: "ti-robot", href:"" },
  { id: "feed-2", title: "New marketplace listing", body: "Desk lamp available for RM20 near the hostel lobby.", tag: "Market", icon: "ti-shopping-cart", href:"" },
  { id: "feed-3", title: "Study group forming", body: "Late night FIN345 revision group at Library L2.", tag: "Forum", icon: "ti-message-circle", href:"" },
];

export const people: Person[] = [
  { id: "person-1", name: "Peter Parker", detail: "Physics - Year 4", initials: "PP", actionLabel: "Connect" },
  { id: "person-2", name: "Ahmad Albab", detail: "Property - Year 3", initials: "AA", actionLabel: "Follow back" },
  { id: "person-3", name: "Giga Chad", detail: "Rizzics - Year 1", initials: "GC", actionLabel: "Connect" },
];

export const campusServices: FeedItem[] = [
  { id: "campus-1", title: "Shuttle Bus", body: "Route B arrives in 6 minutes.", tag: "Live", icon: "ti-bus" , href:"https://activeroute.activetelematics.my/locator/0dcabe20bdff4d0b8a0f8c3a768695c6"},
  { id: "campus-2", title: "Library", body: "Central campus library is open until 10 PM.", tag: "Open", icon: "ti-books", href:"" },
  { id: "campus-3", title: "Internet Maintenance", body: "Scheduled maintenance on 22 June, 8 PM to 10 PM.", tag: "Alert", icon: "ti-wifi-off", href:"" },
];

export const sampleSubjects: Subject[] = [
  {
    id: "subj-1",
    subject_code: "MPB201",
    subject_name: "Radiotherapy",
    description: "Principles and techniques of radiation therapy for cancer treatment.",
    created_by: "user-1",
    created_at: "2026-01-15T08:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
  },
  {
    id: "subj-2",
    subject_code: "FIN345",
    subject_name: "Financial Management",
    description: "Corporate finance, capital budgeting, and financial analysis.",
    created_by: "user-1",
    created_at: "2026-01-15T08:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
  },
  {
    id: "subj-3",
    subject_code: "MPB204",
    subject_name: "Medical Physics",
    description: "Physics principles applied to medicine and diagnostics.",
    created_by: "user-1",
    created_at: "2026-01-15T08:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
  },
];

export const plannerEvents: CalendarEvent[] = [
  {
    id: "class-1",
    title: "Radiotherapy",
    description: "Principles and techniques of radiation therapy.",
    location: "DK A",
    event_type: "class",
    start_time: "2026-06-01T10:00:00",
    end_time: "2026-06-01T12:00:00",
    rrule: "WEEKLY:MO,WE",
    google_event_id: null,
  },
  {
    id: "class-2",
    title: "Financial Management",
    description: "Corporate finance and capital budgeting.",
    location: "DK B",
    event_type: "class",
    start_time: "2026-06-02T14:00:00",
    end_time: "2026-06-02T16:00:00",
    rrule: "WEEKLY:TU",
    google_event_id: null,
  },
  {
    id: "class-3",
    title: "Medical Physics",
    description: "Physics applied to medicine.",
    location: "Lab F",
    event_type: "class",
    start_time: "2026-06-04T10:00:00",
    end_time: "2026-06-04T12:00:00",
    rrule: "WEEKLY:TH",
    google_event_id: null,
  },
  {
    id: "study-1",
    title: "Study group — FIN345",
    description: "Weekly revision with the study group.",
    location: "Library L2",
    event_type: "study",
    start_time: "2026-06-15T19:00:00",
    end_time: "2026-06-15T21:00:00",
    rrule: null,
    google_event_id: null,
  },
  {
    id: "study-2",
    title: "Lab report drafting",
    description: "Draft the dosimetry lab report.",
    location: "Home",
    event_type: "study",
    start_time: "2026-06-18T20:00:00",
    end_time: "2026-06-18T22:00:00",
    rrule: null,
    google_event_id: null,
  },
  {
    id: "task-1",
    title: "Submit lab report",
    description: "Upload final report to eLearn.",
    location: "eLearn",
    event_type: "task",
    start_time: "2026-06-20T17:00:00",
    end_time: "2026-06-20T17:30:00",
    rrule: null,
    google_event_id: null,
  },
  {
    id: "personal-1",
    title: "AI Workshop",
    description: "Hands-on generative AI session.",
    location: "Innovation Lab",
    event_type: "personal",
    start_time: "2026-06-20T16:00:00",
    end_time: "2026-06-20T18:00:00",
    rrule: null,
    google_event_id: null,
  },
  {
    id: "study-3",
    title: "Final exam prep",
    description: "Closed-book mock papers for MPB204.",
    location: "Library L2",
    event_type: "study",
    start_time: "2026-06-22T09:00:00",
    end_time: "2026-06-22T12:00:00",
    rrule: null,
    google_event_id: null,
  },
];
