import { EventList } from "@/components/domain/EventList";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { events } from "@/lib/sample-data";

const eventMetrics = [
  { label: "MyCSD points", value: "420", icon: "ti-trophy", helper: "Earned this year" },
  { label: "Activities done", value: "6", icon: "ti-checkup-list", helper: "Verified attendance" },
  { label: "Wallet coins", value: "850", icon: "ti-coin", helper: "Available balance" },
];

export default function EventsPage() {
  return (
    <AppShell>
      <PageHero
        title="Points and opportunities"
        description="Separate event pages make registration, event details, and reward history easier to build later."
      />

      <section className="metric-grid three">
        {eventMetrics.map((metric) => (
          <MetricCard metric={metric} key={metric.label} />
        ))}
      </section>

      <section>
        <SectionHeader title="Upcoming events" description="Hydrate this from an `events` table when Supabase is connected." icon="ti-ticket" />
        <EventList events={events} />
      </section>

      <section className="responsive-grid">
        <Card>
          <h3>Badges</h3>
          <p>Use metric cards or small badge components to show earned and locked achievements.</p>
        </Card>
        <Card>
          <h3>Opportunities</h3>
          <p>Exchange programs, internships, and summer programs can use the same card/list primitives.</p>
        </Card>
      </section>
    </AppShell>
  );
}
