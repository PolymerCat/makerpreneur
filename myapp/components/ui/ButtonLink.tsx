import Link from "next/link";
import { Icon } from "./Icon";

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  icon?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function ButtonLink({ href, children, icon, variant = "secondary" }: ButtonLinkProps) {
  return (
    <Link className={`button-link button-link-${variant}`} href={href}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}
