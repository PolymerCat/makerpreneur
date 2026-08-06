import { FeedList } from "@/components/domain/FeedList";
import { PeopleList } from "@/components/domain/PeopleList";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { feedItems, people } from "@/lib/sample-data";

export default function CommunityPage() {
  return (
    <AppShell>
      <PageHero
        eyebrow="Community"
        title="Campus conversations"
        description="Posts, groups, marketplace updates, and students to connect with."
        icon="ti-users"
      />

      <section className="two-column">
        <div>
          <SectionHeader title="Latest campus activity" icon="ti-news" />
          <FeedList items={feedItems} />
        </div>
        <div>
          <SectionHeader title="People to connect with" icon="ti-user-search" />
          <PeopleList people={people} />
        </div>
      </section>

      <section>
        <SectionHeader title="Where community happens" description="Forums, clubs, and buy-and-sell spaces all live here." icon="ti-layout-grid" />
        <div className="responsive-grid">
          <Card>
            <h3>Forum threads</h3>
            <p>Place where students can discuss topics and share ideas.</p>
          </Card>
          <Card>
            <h3>Marketplace listings</h3>
            <p>Place where students can buy and sell preloved items.</p>
          </Card>
          <Card>
            <h3>Communities</h3>
            <p>Student Groups, Clubs, Organizations.</p>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
