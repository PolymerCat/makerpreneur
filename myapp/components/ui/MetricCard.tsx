import type { Metric } from "@/lib/types";
import { Card } from "./Card";
import { Icon } from "./Icon";

type MetricCardProps = {
  metric: Metric;
};

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <Card className="metric-card">
      <Icon name={metric.icon} />
      <strong>{metric.value}</strong>
      <span>{metric.label}</span>
      {metric.helper && <small>{metric.helper}</small>}
    </Card>
  );
}
