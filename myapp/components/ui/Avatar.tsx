import { Icon } from "./Icon";

type AvatarProps = {
  initials?: string;
  icon?: string;
  size?: "sm" | "md" | "lg";
};

export function Avatar({ initials, icon, size = "md" }: AvatarProps) {
  return (
    <span className={`avatar avatar-${size}`}>
      {icon ? <Icon name={icon} /> : initials}
    </span>
  );
}
