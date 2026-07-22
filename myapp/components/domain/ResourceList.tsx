import type { Resource } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

type ResourceListProps = {
  resources: Resource[];
};

export function ResourceList({ resources }: ResourceListProps) {
  return (
    <div className="stack">
      {resources.map((resource) => (
        <Card className="media-card" key={resource.id}>
          <Avatar icon={resource.icon} />
          <div>
            <strong>{resource.name}</strong>
            <span>{resource.meta}</span>
          </div>
          <Icon name="ti-download" />
        </Card>
      ))}
    </div>
  );
}
