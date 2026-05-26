import { Breadcrumb, BreadcrumbItem } from "@carbon/react";
import type { CarbonIconType } from "@carbon/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: CarbonIconType;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}

// Shared page chrome. Sits inside the per-app AppShell main content area.
//
// Layout decisions:
// - items-center on the outer flex so the actions block vertically centres
//   against the (taller) title+description block. With items-start the
//   actions look detached at the very top.
// - Generous top + bottom padding (pt-10 / pb-10) so the section feels like
//   a real page header rather than a thin strip glued to the content.
//   Paired with the per-page content wrapper's py-8 the total gap between
//   header text and the first content block reads ~80px — distinct, not
//   collapsed.
export function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div className="border-b border-neutral-200 px-8 pb-10 pt-10">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-3">
          {breadcrumbs.map((b, i) => {
            const isLast = i === breadcrumbs.length - 1;
            if (b.href && !isLast) {
              return (
                <BreadcrumbItem key={`${b.label}-${i}`}>
                  <Link href={b.href}>{b.label}</Link>
                </BreadcrumbItem>
              );
            }
            return (
              <BreadcrumbItem key={`${b.label}-${i}`} isCurrentPage={isLast}>
                {b.label}
              </BreadcrumbItem>
            );
          })}
        </Breadcrumb>
      )}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="mt-1 text-[var(--cds-icon-primary)]">
              <Icon size={28} />
            </div>
          )}
          <div>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 400,
                lineHeight: 1.28,
                letterSpacing: "0.16px",
                margin: 0,
              }}
            >
              {title}
            </h1>
            {description && (
              <p
                className="mt-2 max-w-2xl text-neutral-700"
                style={{ fontSize: "0.875rem", lineHeight: 1.5 }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
