import type { PropsWithChildren } from "react";

type WidgetCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
}>;

export function WidgetCard({ title, subtitle, actionHref, actionLabel = "Open", children }: WidgetCardProps) {
  return (
    <section className="dashboard-widget-card">
      <div className="dashboard-widget-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actionHref ? (
          <a className="dashboard-widget-link" href={actionHref}>
            {actionLabel}
          </a>
        ) : null}
      </div>
      <div className="dashboard-widget-body">{children}</div>
    </section>
  );
}
