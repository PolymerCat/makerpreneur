import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { SosPage } from "@/components/domain/SosPage";

export default function SosRoute() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Safety"
        title="SOS & emergency"
        description="Send a distress alert with your location, reach campus emergency contacts, and know what to do in an emergency."
        icon="ti-urgent"
      />
      <SosPage />
    </AppShell>
  );
}
