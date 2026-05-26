"use client";

import { Pagination } from "@carbon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { patchSearchParams } from "./url-helpers";

interface TablePaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  pageSizes?: number[];
}

// Default page sizes — first entry doubles as the implicit "no pageSize
// in URL" default. Keep DEFAULT_PAGE_SIZE in sync with the page-side
// fallback so the URL stays clean for the most common case.
export const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export function TablePagination({
  totalItems,
  page,
  pageSize,
  pageSizes = DEFAULT_PAGE_SIZES,
}: TablePaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <Pagination
      totalItems={totalItems}
      page={page}
      pageSize={pageSize}
      pageSizes={pageSizes}
      size="md"
      backwardText="Anterior"
      forwardText="Seguinte"
      itemsPerPageText="Itens por página:"
      itemRangeText={(min, max, total) => `${min}–${max} de ${total} itens`}
      pageRangeText={(_current, totalPages) =>
        `de ${totalPages} ${totalPages === 1 ? "página" : "páginas"}`
      }
      onChange={({ page: nextPage, pageSize: nextSize }) => {
        const next = patchSearchParams(params, {
          // Drop page from URL when it's back to 1 / pageSize when default,
          // so the URL stays clean for the most common case.
          page: nextPage > 1 ? String(nextPage) : null,
          pageSize: nextSize !== DEFAULT_PAGE_SIZE ? String(nextSize) : null,
        });
        router.replace(`${pathname}${next}`, { scroll: false });
      }}
    />
  );
}
