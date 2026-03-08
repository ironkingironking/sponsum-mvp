"use client";

import type { DashboardTab } from "@/lib/dashboard";

type DashboardTabsProps = {
  tabs: Array<{ id: DashboardTab; label: string }>;
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

export function DashboardTabs({ tabs, activeTab, onChange }: DashboardTabsProps) {
  return (
    <div className="dashboard-tabs" role="tablist" aria-label="Dashboard tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTab ? "dashboard-tab active" : "dashboard-tab"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
