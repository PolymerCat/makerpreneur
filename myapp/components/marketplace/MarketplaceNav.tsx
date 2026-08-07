"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

type NavLink = {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
};

var NAV_LINKS: NavLink[] = [
  {
    href: "/marketplace/products",
    label: "Browse",
    icon: "ti-shopping-bag",
    match: function (pathname) {
      if (pathname === "/marketplace") return true;
      if (!pathname.startsWith("/marketplace/products")) return false;
      return pathname !== "/marketplace/products/new";
    },
  },
  {
    href: "/marketplace/messages",
    label: "Messages",
    icon: "ti-message-circle",
    match: function (pathname) {
      return pathname.startsWith("/marketplace/messages");
    },
  },
  {
    href: "/marketplace/inbox",
    label: "Inbox",
    icon: "ti-inbox",
    match: function (pathname) {
      return pathname.startsWith("/marketplace/inbox");
    },
  },
  {
    href: "/marketplace/profile",
    label: "Profile",
    icon: "ti-user",
    match: function (pathname) {
      return pathname.startsWith("/marketplace/profile");
    },
  },
];

export function MarketplaceNav() {
  var pathname = usePathname();

  return (
    <nav className="mp-bottom-nav" aria-label="Marketplace navigation">
      {NAV_LINKS.map(function (item) {
        var isActive = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "active" : ""}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
