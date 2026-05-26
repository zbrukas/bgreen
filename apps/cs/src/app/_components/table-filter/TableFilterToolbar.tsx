"use client";

import { TableToolbar, TableToolbarContent, TableToolbarSearch } from "@carbon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { patchSearchParams } from "./url-helpers";

interface TableFilterToolbarProps {
  // Placeholder for the search input (resource-specific copy).
  searchPlaceholder?: string;
  // Rendered to the right of the search box — resource-specific filter
  // dropdowns. Each child should call `useSearchParams` + `useRouter` (or
  // use the `FilterSelect` helper below) to keep state in the URL.
  children?: ReactNode;
}

// Debounce window for the search input. 300 ms is the sweet spot — short
// enough to feel responsive, long enough that a fast typist doesn't fire
// six requests on a four-character query.
const SEARCH_DEBOUNCE_MS = 300;

export function TableFilterToolbar({
  searchPlaceholder = "Pesquisar",
  children,
}: TableFilterToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [draft, setDraft] = useState(urlQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync from URL on back/forward navigation or external param changes.
  useEffect(() => {
    setDraft(urlQ);
  }, [urlQ]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function onSearchChange(value: string) {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Reset page when the search query changes — otherwise the user
      // can be stuck on page 3 of an empty filtered result set.
      const next = patchSearchParams(params, { q: value.trim() || null, page: null });
      router.replace(`${pathname}${next}`, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <TableToolbar>
      <TableToolbarContent>
        <TableToolbarSearch
          placeholder={searchPlaceholder}
          persistent
          value={draft}
          onChange={(event) => {
            // Carbon's TableToolbarSearch fires either a synthetic event or
            // a string (when the input clears via the "x" button).
            const value =
              typeof event === "string"
                ? event
                : (event as React.ChangeEvent<HTMLInputElement>).target.value;
            onSearchChange(value);
          }}
        />
        {children}
      </TableToolbarContent>
    </TableToolbar>
  );
}
