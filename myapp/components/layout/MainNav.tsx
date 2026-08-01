"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

type MainNavProps = {
  items: NavItem[];
  onNavigate?: () => void;
};

export function MainNav({ items, onNavigate }: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="Primary navigation">
      {items.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link className={isActive ? "active" : ""} href={item.href} key={item.href} onClick={onNavigate}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
