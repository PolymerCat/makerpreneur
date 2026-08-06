"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MarketplaceProvider } from "./_lib/MarketplaceProvider";
import { CartProvider } from "./_lib/cart-context";
import { Icon } from "@/components/ui/Icon";

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCreatePage = pathname === "/marketplace/products/new";

  return (
    <MarketplaceProvider>
      <CartProvider>
        <AppShell>
          {children}
          {!isCreatePage && (
            <Link
              href="/marketplace/products/new"
              className="fab-button"
              title="Sell an item"
              aria-label="Sell an item"
            >
              <Icon name="ti-plus" />
            </Link>
          )}
        </AppShell>
      </CartProvider>
    </MarketplaceProvider>
  );
}
