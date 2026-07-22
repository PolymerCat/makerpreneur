import { FeedList } from "@/components/domain/FeedList";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { campusServices } from "@/lib/sample-data";

export default function CampusPage() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Smart Campus"
        title="Services and alerts"
        description="A dedicated page for facilities, notices, transport, contacts, and other operational campus data."
        icon="ti-building"
      />

      <section className="two-column">
        <div>
          <SectionHeader title="Live campus services" icon="ti-broadcast" />
          <FeedList items={campusServices} />
        </div>
        <div>
          <SectionHeader title="Campus contacts" icon="ti-phone" />
          <div className="stack">
            <Card className="contact-card">
              <strong>Campus Security</strong>
              <span>04-653 3333</span>
            </Card>
            <Card className="contact-card">
              <strong>Health Centre</strong>
              <span>04-653 4444</span>
            </Card>
            <Card className="contact-card">
              <strong>Transport Desk</strong>
              <span>04-653 5555</span>
            </Card>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
