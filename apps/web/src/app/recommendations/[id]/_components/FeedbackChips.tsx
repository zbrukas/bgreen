"use client";

// Five-chip row under each recommendation. Clicking a chip upserts the
// user's feedback for (generation, index, kind); clicking the same chip
// again leaves the kind unchanged (server treats it as idempotent).
// PRD acceptance: "switching the choice updates the existing row" —
// the server-side ON CONFLICT path covers this; the UI just sends the
// new kind.

import { cn } from "@/lib/utils";
import {
  FEEDBACK_LABEL,
  type FeedbackKind,
} from "@/lib/recommendations-types";

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
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
          >
            {FEEDBACK_LABEL[kind]}
          </button>
        );
      })}
    </div>
  );
}
