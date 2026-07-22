import { navItems } from "@/lib/sample-data";
import { MainNav } from "./MainNav";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">SH</span>
          <div>
            <strong>StudentHub USM</strong>
            <span>Campus workspace</span>
          </div>
        </div>
        <MainNav items={navItems} />
      </aside>
      <main className="content-shell">{children}</main>
    </div>
  );
}
