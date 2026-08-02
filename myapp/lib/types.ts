export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export type Metric = {
  label: string;
  value: string;
  icon: string;
  helper?: string;
};

export type Task = {
  id: string;
  title: string;
  due: string;
  status: string;
  priority: "high" | "medium" | "low";
};

export type CampusEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  points: number;
  category: string;
};

export type FeedItem = {
  id: string;
  title: string;
  body: string;
  tag: string;
  icon: string;
  href: string;
};

export type Person = {
  id: string;
  name: string;
  detail: string;
  initials: string;
  actionLabel: string;
};

export type Resource = {
  id: string;
  name: string;
  meta: string;
  icon: string;
};

export type Subject = {
  id: string;
  subject_code: string;
  subject_name: string;
  description: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  event_type: "class" | "study" | "task" | "personal";
  start_time: string;
  end_time: string;
  rrule: string | null;
  google_event_id: string | null;
};
