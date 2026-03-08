"use client";

import type { ChangeEvent } from "react";
import { filterOptions, roleLabels } from "@/lib/dashboard";
import type { DashboardFilters, DashboardRole } from "@/lib/dashboard";

type DashboardHeaderProps = {
  role: DashboardRole;
  filters: DashboardFilters;
  onRoleChange: (role: DashboardRole) => void;
  onFiltersChange: (filters: DashboardFilters) => void;
};

function patchFilters(
  filters: DashboardFilters,
  onFiltersChange: (filters: DashboardFilters) => void,
  patch: Partial<DashboardFilters>
) {
  onFiltersChange({
    ...filters,
    ...patch
  });
}

export function DashboardHeader({ role, filters, onRoleChange, onFiltersChange }: DashboardHeaderProps) {
  function handleRoleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextRole = event.target.value as DashboardRole;
    onRoleChange(nextRole);
    patchFilters(filters, onFiltersChange, { role: nextRole });
  }

  return (
    <header className="dashboard-header">
      <div>
        <h1>Sponsum Operations Dashboard</h1>
        <p>Pipeline, Risiko, Settlement, Disputes und Marketplace-Aktivitaet in einer Arbeitsflaeche.</p>
      </div>

      <div className="dashboard-filter-grid">
        <label>
          Rolle
          <select value={role} onChange={handleRoleChange}>
            {Object.entries(roleLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Zeitraum
          <select
            value={filters.period}
            onChange={(event) => patchFilters(filters, onFiltersChange, { period: event.target.value as DashboardFilters["period"] })}
          >
            {filterOptions.periods.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Instrumenttyp
          <select
            value={filters.instrumentType}
            onChange={(event) =>
              patchFilters(filters, onFiltersChange, {
                instrumentType: event.target.value as DashboardFilters["instrumentType"]
              })
            }
          >
            {filterOptions.instrumentTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select
            value={filters.status}
            onChange={(event) =>
              patchFilters(filters, onFiltersChange, {
                status: event.target.value as DashboardFilters["status"]
              })
            }
          >
            {filterOptions.statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-checkbox">
          <input
            type="checkbox"
            checked={filters.onlyMine}
            onChange={(event) => patchFilters(filters, onFiltersChange, { onlyMine: event.target.checked })}
          />
          Nur meine Faelle
        </label>

        <label className="dashboard-checkbox">
          <input
            type="checkbox"
            checked={filters.onlyCritical}
            onChange={(event) => patchFilters(filters, onFiltersChange, { onlyCritical: event.target.checked })}
          />
          Nur kritische Faelle
        </label>
      </div>
    </header>
  );
}
