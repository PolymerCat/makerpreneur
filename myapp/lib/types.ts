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
