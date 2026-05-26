"use client";

import { Dropdown } from "@carbon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { patchSearchParams } from "./url-helpers";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  paramKey: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
  // Min width for the dropdown trigger — passed via inline style so long
  // option labels don't get truncated by Carbon's default narrow Dropdown.
  minWidth?: string;
}

// A URL-bound Dropdown for resource-specific filters (status, role, …).
// Selecting an option pushes `?{paramKey}=value`; selecting "all" removes
// the param entirely so the URL stays clean.
//
// Renders inline as `<Label> [Dropdown ▾]` — the visible label is what
// distinguishes filters when several are stacked in the same toolbar.
export function FilterSelect({
  paramKey,
  label,
  options,
  allLabel = "Todos",
  minWidth = "14rem",
}: FilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramKey);

  const items: FilterOption[] = [{ value: "", label: allLabel }, ...options];
  const selected = items.find((i) => i.value === (current ?? "")) ?? items[0];

  return (
    <label className="flex items-center gap-2 px-2 text-sm">
      <span className="whitespace-nowrap text-neutral-600">{label}:</span>
      <div style={{ minWidth }}>
        <Dropdown
          id={`filter-${paramKey}`}
          titleText=""
          hideLabel
          label={allLabel}
          size="md"
          // autoAlign portals the open menu via floating-ui so it escapes
          // the TableContainer's `overflow-hidden` and isn't clipped when
          // the table has few/no rows.
          autoAlign
          items={items}
          itemToString={(item: FilterOption | null) => item?.label ?? ""}
          selectedItem={selected}
          onChange={({ selectedItem }: { selectedItem: FilterOption | null }) => {
            // Reset page on filter change — applying a filter on page 3
            // would otherwise leave the user on an empty filtered page.
            const next = patchSearchParams(params, {
              [paramKey]: selectedItem && selectedItem.value !== "" ? selectedItem.value : null,
              page: null,
            });
            router.replace(`${pathname}${next}`, { scroll: false });
          }}
        />
      </div>
    </label>
  );
}
