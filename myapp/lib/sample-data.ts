import type { CampusEvent, FeedItem, Metric, NavItem, Person, Resource, Task } from "./types";

// Temporary seed data. Later, replace these exports with Supabase queries that return the same shapes.
export const navItems: NavItem[] = [
  { href: "/home", label: "Home", icon: "ti-home" },
  { href: "/community", label: "Community", icon: "ti-users" },
  { href: "/study", label: "Study", icon: "ti-school" },
  { href: "/events", label: "MyCSD", icon: "ti-confetti" },
  { href: "/campus", label: "Campus", icon: "ti-building" },
  { href: "/profile", label: "Profile", icon: "ti-user" },
];

export const dashboardMetrics: Metric[] = [
  { label: "MyCSD points", value: "420", icon: "ti-trophy", helper: "42% to yearly target" },
  { label: "Wallet coins", value: "850", icon: "ti-coin", helper: "Redeemable on campus" },
  { label: "Study streak", value: "15", icon: "ti-flame", helper: "Days in a row" },
  { label: "Events joined", value: "12", icon: "ti-confetti", helper: "This semester" },
];

export const tasks: Task[] = [
  { id: "task-1", title: "FIN345 Assignment", due: "Due tomorrow", status: "Urgent", priority: "high" },
  { id: "task-2", title: "Radiotherapy tutorial", due: "Today at 10:00 AM", status: "Next class", priority: "medium" },
  { id: "task-3", title: "Lab Report", due: "Due in 3 days", status: "Drafting", priority: "low" },
];

export const events: CampusEvent[] = [
  { id: "event-1", name: "Career Talk", date: "20 June 2026", time: "2:00 PM", location: "DK A", points: 2, category: "Career" },
  { id: "event-2", name: "AI Workshop", date: "20 June 2026", time: "4:00 PM", location: "Innovation Lab", points: 3, category: "Technology" },
  { id: "event-3", name: "Beach Clean-up", date: "5 July 2026", time: "8:00 AM", location: "Batu Ferringhi", points: 12, category: "Volunteer" },
];

export const feedItems: FeedItem[] = [
  { id: "feed-1", title: "AI Workshop starts soon", body: "Registration closes tonight for the 4:00 PM lab session.", tag: "Event", icon: "ti-robot" },
  { id: "feed-2", title: "New marketplace listing", body: "Desk lamp available for RM20 near the hostel lobby.", tag: "Market", icon: "ti-shopping-cart" },
  { id: "feed-3", title: "Study group forming", body: "Late night FIN345 revision group at Library L2.", tag: "Forum", icon: "ti-message-circle" },
];

export const people: Person[] = [
  { id: "person-1", name: "Sarah Ahmad", detail: "Medical Physics - Year 4", initials: "SA", actionLabel: "Connect" },
  { id: "person-2", name: "Ali Hassan", detail: "Finance - Year 3", initials: "AH", actionLabel: "Follow back" },
  { id: "person-3", name: "Mei Ling", detail: "Science - Year 1", initials: "ML", actionLabel: "Connect" },
];

export const resources: Resource[] = [
  { id: "resource-1", name: "Final exam roadmap", meta: "PDF - 600 KB", icon: "ti-file-text" },
  { id: "resource-2", name: "Formula sheet - Physics", meta: "PDF - 420 KB", icon: "ti-map" },
  { id: "resource-3", name: "Radiotherapy recap", meta: "Video - 18 min", icon: "ti-video" },
];

export const campusServices: FeedItem[] = [
  { id: "campus-1", title: "Shuttle Bus", body: "Route B arrives in 6 minutes.", tag: "Live", icon: "ti-bus" },
  { id: "campus-2", title: "Library", body: "Central campus library is open until 10 PM.", tag: "Open", icon: "ti-books" },
  { id: "campus-3", title: "Internet Maintenance", body: "Scheduled maintenance on 22 June, 8 PM to 10 PM.", tag: "Alert", icon: "ti-wifi-off" },
];
