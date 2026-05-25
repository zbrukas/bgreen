"use client";

// Tab-style framework picker. Updates the URL search param so a
// reload + share link land on the same framework. Keeping it in URL
// state also means the matrix re-fetch happens via server-side route
// re-render — no client cache to invalidate.

import { FRAMEWORK_LABEL, type Framework } from "@/lib/coverage-types";
import Link from "next/link";

const FRAMEWORKS: Framework[] = ["esrs", "ghg", "gri"];

interface FrameworkPickerProps {
  active: Framework;
  extraSearch?: string;
}

export function FrameworkPicker({ active, extraSearch }: FrameworkPickerProps) {
  return (
    <nav className="flex gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1">
      {FRAMEWORKS.map((f) => {
        const isActive = f === active;
        const search = new URLSearchParams(extraSearch ?? "");
        search.set("framework", f);
        return (
          <Link
            key={f}
            href={`/coverage?${search.toString()}`}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {FRAMEWORK_LABEL[f]}
          </Link>
        );
      })}
    </nav>
  );
}
