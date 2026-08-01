"use client";

import { useState } from "react";
import { navItems } from "@/lib/sample-data";
import { MainNav } from "./MainNav";
import { Icon } from "@/components/ui/Icon";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="topbar-burger"
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
        >
          <Icon name={navOpen ? "ti-x" : "ti-menu-2"} />
        </button>

        <div className="brand-block">
          <img src="/logo-crest.webp" alt="USM Crest Logo" className="brand-mark" style={{ objectFit: "contain", padding: "2px", background: "#fff" }} />
          <div>
            <strong>StudentHub USM</strong>
            <span>Campus workspace</span>
          </div>
        </div>
      </header>

      <div className={`drawer-backdrop ${navOpen ? "open" : ""}`} onClick={closeNav} aria-hidden="true" />

      <aside className={`drawer ${navOpen ? "open" : ""}`} aria-hidden={!navOpen}>
        <div className="drawer-head">
          <img src="/logo-crest.webp" alt="USM Crest Logo" className="brand-mark" style={{ objectFit: "contain", padding: "2px", background: "#fff" }} />
          <strong>Navigation</strong>
          <button className="drawer-close" type="button" onClick={closeNav} aria-label="Close navigation">
            <Icon name="ti-x" />
          </button>
        </div>

        <MainNav items={navItems} onNavigate={closeNav} />

        <p className="drawer-foot">StudentHub USM · campus workspace</p>
      </aside>

      <main className="content-shell">{children}</main>
    </div>
  );
}
