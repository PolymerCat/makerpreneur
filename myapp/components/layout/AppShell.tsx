"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { navItems } from "@/lib/sample-data";
import { MainNav } from "./MainNav";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth-context";
import { SosButton } from "@/components/domain/SosButton";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { supabase, user } = useSession();
  const [navOpen, setNavOpen] = useState(false);

  function closeNav() {
    setNavOpen(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        {navOpen ? (
          <button
            className="topbar-burger"
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            aria-expanded="true"
            aria-controls="app-drawer"
          >
            <Icon name="ti-x" />
          </button>
        ) : (
          <button
            className="topbar-burger"
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded="false"
            aria-controls="app-drawer"
          >
            <Icon name="ti-menu-2" />
          </button>
        )}

        <div className="brand-block">
          <img src="/logo-crest.webp" alt="USM Crest Logo" className="brand-mark" />
          <div>
            <strong>StudentHub USM</strong>
            <span>Campus workspace</span>
          </div>
        </div>

        {user && (
          <button className="topbar-logout" type="button" onClick={handleLogout} aria-label="Sign out">
            <Icon name="ti-logout" />
            <span>Sign out</span>
          </button>
        )}
      </header>

      <div className={`drawer-backdrop ${navOpen ? "open" : ""}`} onClick={closeNav} aria-hidden="true" />

      <aside
        id="app-drawer"
        className={`drawer ${navOpen ? "open" : ""}`}
        aria-hidden={navOpen ? "false" : "true"}
        inert={!navOpen ? true : undefined}
      >
        <div className="drawer-head">
          <img src="/logo-crest.webp" alt="USM Crest Logo" className="brand-mark" />
          <strong>Navigation</strong>
          <button className="drawer-close" type="button" onClick={closeNav} aria-label="Close navigation">
            <Icon name="ti-x" />
          </button>
        </div>

        <div className="drawer-scroll">
          <MainNav items={navItems} onNavigate={closeNav} />
          <SosButton />
        </div>

        <p className="drawer-foot">StudentHub USM · campus workspace</p>
      </aside>

      <main className="content-shell">{children}</main>
    </div>
  );
}
