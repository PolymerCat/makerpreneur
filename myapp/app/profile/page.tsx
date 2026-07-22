import { PeopleList } from "@/components/domain/PeopleList";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { people } from "@/lib/sample-data";

const profileMetrics = [
  { label: "Followers", value: "250", icon: "ti-users" },
  { label: "Following", value: "180", icon: "ti-user-check" },
  { label: "Posts", value: "4", icon: "ti-notes" },
];

export default function ProfilePage() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Profile"
        title="Julita Aishah"
        description="Profile, posts, followers, and settings should live as routes or nested route groups as the app grows."
        icon="ti-user"
      />

      <section className="two-column">
        <Card className="profile-summary">
          <Avatar initials="JA" size="lg" />
          <h2>Julita Aishah</h2>
          <strong>Medical Physics & Finance</strong>
          <Badge>Year 4</Badge>
          <p>Interested in Medical Physics, Finance and Research.</p>
        </Card>
        <div className="metric-grid compact">
          {profileMetrics.map((metric) => (
            <MetricCard metric={metric} key={metric.label} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Followers preview" description="Keep the list component reusable for followers, classmates, clubs, and search results." icon="ti-users" />
        <PeopleList people={people} />
      </section>
    </AppShell>
  );
}
