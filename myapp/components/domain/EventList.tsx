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
        <Card className="event-card" key={event.id}>
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
      ))}
    </div>
  );
}
