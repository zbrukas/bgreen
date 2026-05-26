"use client";

import { Button, ButtonSet, Tile } from "@carbon/react";
import type { ReactNode } from "react";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  title: string;
  description: string;
  primaryAction?: EmptyStateAction;
  // Pre-rendered icon element (`<Add />`), NOT the component reference
  // (`Add`). Carbon icons are forwardRef objects that aren't Next client
  // references, so they can't cross a server→client boundary as a prop
  // value. JSX elements cross cleanly because they're serialised through
  // React's normal element protocol — but Carbon's `renderIcon` prop
  // expects a component type, so we render the element inline next to
  // the label instead.
  primaryIcon?: ReactNode;
  secondaryAction?: EmptyStateAction;
  secondaryIcon?: ReactNode;
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
              >
                <span className="inline-flex items-center gap-2">
                  {secondaryIcon}
                  {secondaryAction.label}
                </span>
              </Button>
            )}
            {primaryAction && (
              <Button
                kind="primary"
                href={primaryAction.href}
                onClick={primaryAction.onClick}
              >
                <span className="inline-flex items-center gap-2">
                  {primaryIcon}
                  {primaryAction.label}
                </span>
              </Button>
            )}
          </ButtonSet>
        )}
      </div>
    </Tile>
  );
}
