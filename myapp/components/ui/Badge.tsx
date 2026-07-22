type BadgeTone = "neutral" | "brand" | "warning" | "success";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
};

export function Badge({ children, tone = "brand" }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
