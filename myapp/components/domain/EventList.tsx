import Link from "next/link";
import type { CampusEvent } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

type EventListProps = {
  events: CampusEvent[];
};

export function EventList({ events }: EventListProps) {
  return (
    <div className="responsive-grid">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/events?eventId=${event.id}`}
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <Card className="event-card" style={{ height: "100%", cursor: "pointer" }}>
            <Badge tone="neutral">{event.category}</Badge>
            <h3>{event.name}</h3>
            <p>
              <Icon name="ti-calendar" />
              {event.date} at {event.time}
            </p>
            <p>
              <Icon name="ti-map-pin" />
              {event.location}
            </p>
            <Badge>{event.points} MyCSD points</Badge>
          </Card>
        </Link>
      ))}
    </div>
  );
}
