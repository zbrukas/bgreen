"use client";

import type { CsHealthTier } from "@bgreen/types";
import { Tag } from "@carbon/react";

export interface HealthFilterState {
  tier: CsHealthTier | null;
  hasStagnantWork: boolean;
}

interface HealthFiltersProps {
  value: HealthFilterState;
  onChange: (next: HealthFilterState) => void;
}

const TIERS: Array<{ value: CsHealthTier; label: string; type: "green" | "warm-gray" | "red" }> = [
  { value: "red", label: "Vermelho", type: "red" },
  { value: "yellow", label: "Amarelo", type: "warm-gray" },
  { value: "green", label: "Verde", type: "green" },
];

export function HealthFilters({ value, onChange }: HealthFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-[--cds-text-secondary]">Filtrar:</span>
      {TIERS.map((t) => {
        const active = value.tier === t.value;
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange({ ...value, tier: active ? null : t.value })
            }
            className={`rounded-full ${active ? "" : "opacity-60"} transition-opacity`}
          >
            <Tag size="md" type={t.type}>
              {t.label}
            </Tag>
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={value.hasStagnantWork}
        onClick={() =>
          onChange({ ...value, hasStagnantWork: !value.hasStagnantWork })
        }
        className={`rounded-full ${value.hasStagnantWork ? "" : "opacity-60"} transition-opacity`}
      >
        <Tag size="md" type="purple">
          Trabalho parado ≥14d
        </Tag>
      </button>
      {(value.tier !== null || value.hasStagnantWork) && (
        <button
          type="button"
          onClick={() => onChange({ tier: null, hasStagnantWork: false })}
          className="text-sm text-[--cds-link-primary] underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
