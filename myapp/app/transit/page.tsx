import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { TransitMap } from "@/components/domain/TransitMap";

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
        <Card className="transit-card">
          <TransitMap />
        </Card>
      </section>
    </AppShell>
  );
}
