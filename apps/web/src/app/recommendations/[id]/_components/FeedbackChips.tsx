"use client";

import { FEEDBACK_LABEL, type FeedbackKind } from "@/lib/recommendations-types";

const CHIP_ORDER: FeedbackKind[] = [
  "util",
  "ja_implementada",
  "nao_aplicavel",
  "irrelevante",
  "incorreta",
];

interface FeedbackChipsProps {
  selected: FeedbackKind | null;
  onSelect: (kind: FeedbackKind) => void;
  disabled?: boolean;
}

export function FeedbackChips({ selected, onSelect, disabled }: FeedbackChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIP_ORDER.map((kind) => {
        const isSelected = selected === kind;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onSelect(kind)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? "border-[var(--cds-interactive)] bg-[var(--cds-interactive)] text-[#37323e]"
                : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            {FEEDBACK_LABEL[kind]}
          </button>
        );
      })}
    </div>
  );
}
