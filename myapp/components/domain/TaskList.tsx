import type { Task } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type TaskListProps = {
  tasks: Task[];
};

const priorityTone: Record<Task["priority"], "warning" | "brand" | "success"> = {
  high: "warning",
  medium: "brand",
  low: "success",
};

export function TaskList({ tasks }: TaskListProps) {
  return (
    <div className="stack">
      {tasks.map((task) => (
        <Card className="row-card" key={task.id}>
          <div>
            <strong>{task.title}</strong>
            <span>{task.due}</span>
          </div>
          <Badge tone={priorityTone[task.priority]}>{task.status}</Badge>
        </Card>
      ))}
    </div>
  );
}
