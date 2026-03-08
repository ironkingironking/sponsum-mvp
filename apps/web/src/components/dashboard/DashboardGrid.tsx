import type { ReactNode } from "react";
import type { WidgetConfig } from "@/lib/dashboard";

type DashboardGridProps = {
  widgets: WidgetConfig[];
  renderWidget: (widget: WidgetConfig) => ReactNode;
};

function sizeToClass(size: WidgetConfig["defaultSize"]): string {
  if (size === "lg") {
    return "dashboard-span-lg";
  }
  if (size === "md") {
    return "dashboard-span-md";
  }
  return "dashboard-span-sm";
}

export function DashboardGrid({ widgets, renderWidget }: DashboardGridProps) {
  return (
    <div className="dashboard-grid">
      {widgets.map((widget) => (
        <div key={widget.id} className={sizeToClass(widget.defaultSize)}>
          {renderWidget(widget)}
        </div>
      ))}
    </div>
  );
}
