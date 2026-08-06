"use client";

import { useState } from "react";

type Tab = {
  id: string;
  label: string;
};

type TabPane = {
  id: string;
  content: React.ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  panes: TabPane[];
  defaultTab?: string;
  onTabChange?: (id: string) => void;
};

/** Minimal tab switcher (no radix). Renders tab buttons + the active pane. */
export function Tabs({ tabs, panes, defaultTab, onTabChange }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || "");

  function select(id: string) {
    setActive(id);
    onTabChange?.(id);
  }

  const activePane = panes.find((p) => p.id === active);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`btn btn-sm ${active === tab.id ? "btn-primary" : ""}`}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activePane?.content}
    </div>
  );
}
