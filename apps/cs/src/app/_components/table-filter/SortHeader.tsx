"use client";

import { ArrowDown, ArrowUp, ArrowsVertical } from "@carbon/icons-react";
import { TableHeader } from "@carbon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { patchSearchParams } from "./url-helpers";

interface SortHeaderProps {
  sortKey: string;
  defaultDir?: "asc" | "desc";
  children: ReactNode;
}

// Click cycles: unsorted → defaultDir → opposite dir → unsorted (back to
// the table's repo-side default). Carbon's TableHeader already supports
// an `isSortable` + `sortDirection` API, but it's wired for client-side
// DataTable. We render a plain TableHeader and own the click ourselves.
export function SortHeader({ sortKey, defaultDir = "asc", children }: SortHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const activeSort = params.get("sort");
  const activeDir = params.get("dir") as "asc" | "desc" | null;
  const isActive = activeSort === sortKey;

  function nextState(): { sort: string | null; dir: string | null } {
    if (!isActive) return { sort: sortKey, dir: defaultDir };
    if (activeDir === defaultDir) {
      return { sort: sortKey, dir: defaultDir === "asc" ? "desc" : "asc" };
    }
    return { sort: null, dir: null };
  }

  function onClick() {
    const { sort, dir } = nextState();
    // Reset page on sort change — keeps the user near the top of the
    // re-ordered result set instead of stranded on a stale page index.
    const next = patchSearchParams(params, { sort, dir, page: null });
    router.replace(`${pathname}${next}`, { scroll: false });
  }

  const Icon = !isActive ? ArrowsVertical : activeDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHeader>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-left font-medium text-[var(--cds-text-primary)] hover:text-[var(--cds-link-primary)]"
      >
        <span>{children}</span>
        <Icon
          size={14}
          className={isActive ? "text-[var(--cds-link-primary)]" : "text-neutral-400"}
        />
      </button>
    </TableHeader>
  );
}
