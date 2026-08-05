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
      {items.map((item) => {
        var card = (
          <Card className="media-card" key={item.id}>
            <Avatar icon={item.icon} size="md" className="justify-items-center" />
            <div>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </div>
            <Badge tone={item.tag === "Alert" ? "warning" : "brand"}>{item.tag}</Badge>
          </Card>
        );

        if (!item.href) {
          return card;
        }

        var external = item.href.startsWith("http");
        return (
          <a
            key={item.id}
            href={item.href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="media-card-link"
          >
            {card}
          </a>
        );
      })}
    </div>
  );
}
