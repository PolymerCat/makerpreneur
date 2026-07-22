import type { FeedItem } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type FeedListProps = {
  items: FeedItem[];
};

export function FeedList({ items }: FeedListProps) {
  return (
    <div className="stack">
      {items.map((item) => (
        <Card className="media-card" key={item.id}>
          <Avatar icon={item.icon} />
          <div>
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </div>
          <Badge tone={item.tag === "Alert" ? "warning" : "brand"}>{item.tag}</Badge>
        </Card>
      ))}
    </div>
  );
}
