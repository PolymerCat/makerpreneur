import { ResourceList } from "@/components/domain/ResourceList";
import { TaskList } from "@/components/domain/TaskList";
import { SubjectsSection } from "@/components/domain/SubjectsSection";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { resources, tasks } from "@/lib/sample-data";

export default function StudyPage() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Study"
        title="Planner and resources"
        description="Manage assignments, subjects, study materials, rooms, and AI tools."
        icon="ti-school"
      />

      <section className="two-column">
        <div>
          <SectionHeader title="Planner" icon="ti-calendar-check" />
          <TaskList tasks={tasks} />
        </div>
        <div>
          <SectionHeader title="Resource library" icon="ti-books" />
          <ResourceList resources={resources} />
        </div>
      </section>

      <SubjectsSection />

      <section className="responsive-grid">
        <Card>
          <h3>Study rooms</h3>
          <p>Model rooms as records with host, capacity, privacy, and current participants.</p>
        </Card>
        <Card>
          <h3>AI companion</h3>
          <p>Keep the chat UI separate from data fetching so it can call API routes or Supabase Edge Functions later.</p>
        </Card>
      </section>
    </AppShell>
  );
}
