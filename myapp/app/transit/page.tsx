import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";

export default function TransitPage() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Transit"
        title="Campus shuttle tracking"
        description="Live bus routes and arrival times across campus."
        icon="ti-bus"
      />

      <section className="stack">
        <Card className="contact-card">
          <strong>Live tracking coming soon</strong>
          <span>The real-time shuttle map will appear here.</span>
        </Card>
      </section>
    </AppShell>
  );
}
