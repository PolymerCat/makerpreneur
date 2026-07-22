import type { Person } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";

type PeopleListProps = {
  people: Person[];
};

export function PeopleList({ people }: PeopleListProps) {
  return (
    <div className="stack">
      {people.map((person) => (
        <Card className="media-card" key={person.id}>
          <Avatar initials={person.initials} />
          <div>
            <strong>{person.name}</strong>
            <span>{person.detail}</span>
          </div>
          <button className="small-action" type="button">
            {person.actionLabel}
          </button>
        </Card>
      ))}
    </div>
  );
}
