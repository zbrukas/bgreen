"use client";

import type { CarbonIconType } from "@carbon/icons-react";
import { Button, ButtonSet, Tile } from "@carbon/react";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  title: string;
  description: string;
  primaryAction?: EmptyStateAction;
  // Icons travel as separate top-level props (not nested inside the action
  // object) so Next's client-reference machinery recognises the Carbon icon
  // and can serialise the prop across a server→client component boundary.
  // Stuffing an icon into a plain object hides the client reference and
  // produces the runtime "Only plain objects can be passed" error.
  primaryIcon?: CarbonIconType;
  secondaryAction?: EmptyStateAction;
  secondaryIcon?: CarbonIconType;
}

// Inline-SVG illustration kept local: no extra deps, scales cleanly, and
// reads as a generic "no data" cue across dashboard / inbox / records /
// profile contexts. Switch per-page if a more specific visual is needed.
function EmptyStateIllustration() {
  return (
    <svg width={120} height={96} viewBox="0 0 120 96" role="img" aria-label="">
      <rect x="20" y="16" width="80" height="64" fill="#f4f4f4" stroke="#c6c6c6" />
      <rect x="28" y="24" width="40" height="6" fill="#c6c6c6" />
      <rect x="28" y="36" width="64" height="4" fill="#e0e0e0" />
      <rect x="28" y="44" width="50" height="4" fill="#e0e0e0" />
      <rect x="28" y="52" width="60" height="4" fill="#e0e0e0" />
      <circle cx="60" cy="68" r="6" fill="#63b995" opacity="0.25" />
      <circle cx="60" cy="68" r="3" fill="#63b995" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  primaryAction,
  primaryIcon,
  secondaryAction,
  secondaryIcon,
}: EmptyStateProps) {
  return (
    <Tile>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <EmptyStateIllustration />
        <div className="max-w-md">
          <h3 style={{ fontSize: "1.25rem", fontWeight: 400, margin: 0 }}>{title}</h3>
          <p className="mt-1 text-sm text-neutral-700">{description}</p>
        </div>
        {(primaryAction || secondaryAction) && (
          <ButtonSet>
            {secondaryAction && (
              <Button
                kind="secondary"
                href={secondaryAction.href}
                onClick={secondaryAction.onClick}
                renderIcon={secondaryIcon}
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                kind="primary"
                href={primaryAction.href}
                onClick={primaryAction.onClick}
                renderIcon={primaryIcon}
              >
                {primaryAction.label}
              </Button>
            )}
          </ButtonSet>
        )}
      </div>
    </Tile>
  );
}
