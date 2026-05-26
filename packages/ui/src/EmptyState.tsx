"use client";

import { Button, ButtonSet } from "@carbon/react";
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

// Bigger, airier inline-SVG illustration. The whole component renders
// transparent (no Tile/card wrapper) so it sits naturally on the page
// background instead of looking like a darker grey block.
function EmptyStateIllustration() {
  return (
    <svg width={160} height={128} viewBox="0 0 160 128" role="img" aria-label="">
      <rect x="28" y="20" width="104" height="88" rx="2" fill="#ffffff" stroke="#c6c6c6" />
      <rect x="40" y="32" width="56" height="6" rx="1" fill="#c6c6c6" />
      <rect x="40" y="48" width="80" height="4" rx="1" fill="#e0e0e0" />
      <rect x="40" y="58" width="64" height="4" rx="1" fill="#e0e0e0" />
      <rect x="40" y="68" width="72" height="4" rx="1" fill="#e0e0e0" />
      <circle cx="80" cy="92" r="9" fill="#63b995" opacity="0.18" />
      <circle cx="80" cy="92" r="4" fill="#63b995" />
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
    <div className="flex flex-col items-center gap-6 px-6 py-20 text-center">
      <EmptyStateIllustration />
      <div className="max-w-md">
        <h3
          style={{
            fontSize: "1.5rem",
            fontWeight: 400,
            lineHeight: 1.33,
            letterSpacing: "0.16px",
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-neutral-700" style={{ lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-2">
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
        </div>
      )}
    </div>
  );
}
