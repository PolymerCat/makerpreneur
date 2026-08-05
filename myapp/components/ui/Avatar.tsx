import { Icon } from "./Icon";

type AvatarProps = {
  initials?: string;
  icon?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Avatar({ initials, icon, size = "md", className = "" }: AvatarProps) {
  return (
    <span className={`avatar avatar-${size} ${className}`}>
      {icon ? <Icon name={icon} /> : initials}
    </span>
  );
}
