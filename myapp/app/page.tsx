import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { EventList } from "@/components/domain/EventList";
import { TaskList } from "@/components/domain/TaskList";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { dashboardMetrics, events, tasks } from "@/lib/sample-data";

export default function DashboardPage() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Friday, 20 June 2026"
        title="Good morning, Aqif"
        description="A compact campus dashboard for classes, reminders, points, and student activity."
        icon="ti-sparkles"
        primaryAction={{ href: "/study", label: "Open study planner" }}
      />

      <section className="metric-grid">
        {dashboardMetrics.map((metric) => (
          <MetricCard metric={metric} key={metric.label} />
        ))}
      </section>

      <section className="two-column">
        <div>
          <SectionHeader title="Priority reminders" description="Tasks that need attention first." icon="ti-alarm" />
          <TaskList tasks={tasks} />
        </div>
        <Card className="schedule-panel">
          <SectionHeader title="Today schedule" icon="ti-calendar-event" />
          <div className="timeline-row">
            <strong>10:00 AM</strong>
            <span>Radiotherapy</span>
          </div>
          <div className="timeline-row">
            <strong>2:00 PM</strong>
            <span>Financial Management</span>
          </div>
          <ButtonLink href="/study" icon="ti-books">
            View planner
          </ButtonLink>
        </Card>
      </section>

      <section>
        <SectionHeader title="Events today" description="Use the event components anywhere you need campus activities." icon="ti-confetti" />
        <EventList events={events.slice(0, 2)} />
      </section>
    </AppShell>
  );
}
