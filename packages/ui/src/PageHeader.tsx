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

// Shared page chrome used by both apps/web and apps/cs. Sits inside the
// per-app AppShell main content area.
export function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div className="border-b border-neutral-200 px-8 pb-6 pt-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-2">
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
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="mt-1 text-[var(--cds-icon-primary)]">
              <Icon size={24} />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 400, lineHeight: 1.28, margin: 0 }}>
              {title}
            </h1>
            {description && (
              <p
                className="mt-1 max-w-2xl text-neutral-700"
                style={{ fontSize: "0.875rem", lineHeight: 1.43 }}
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
