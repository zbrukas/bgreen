"use client";

import type { CsHealthTier } from "@bgreen/types";
import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@carbon/react";
import type { CsHealthListEntry } from "@/lib/cs-health-types";

interface HealthTableProps {
  entries: CsHealthListEntry[];
  tierLabel: Record<CsHealthTier, string>;
  tierTag: Record<CsHealthTier, "green" | "warm-gray" | "red">;
  onRowClick: (organizationId: string) => void;
}

const HEADERS = [
  { key: "tier", header: "Tier" },
  { key: "organizationId", header: "Organização" },
  { key: "score", header: "Score" },
  { key: "coverage", header: "Cobertura" },
  { key: "lastLogin", header: "Último login" },
  { key: "stagnant", header: "Parados" },
  { key: "engagement", header: "Engagement" },
];

export function HealthTable({ entries, tierLabel, tierTag, onRowClick }: HealthTableProps) {
  const rows = entries.map((e) => ({
    id: e.row.organizationId,
    tier: tierLabel[e.healthTier],
    organizationId: e.row.organizationId.slice(0, 8),
    score: `${e.healthScore}`,
    coverage:
      e.row.coveragePercent === null ? "—" : `${e.row.coveragePercent.toFixed(0)}%`,
    lastLogin:
      e.row.daysSinceLastLogin === null
        ? "Nunca"
        : `há ${e.row.daysSinceLastLogin}d`,
    stagnant: `${e.row.stagnantWorkflowsCount}`,
    engagement:
      e.row.engagementTrend === "up"
        ? "↑"
        : e.row.engagementTrend === "down"
          ? "↓"
          : "→",
    raw: e,
  }));

  return (
    <DataTable rows={rows} headers={HEADERS}>
      {({
        rows: dtRows,
        headers,
        getHeaderProps,
        getRowProps,
        getTableProps,
        getTableContainerProps,
      }) => (
        <TableContainer {...getTableContainerProps()}>
          <Table {...getTableProps()} aria-label="Saúde das organizações">
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader {...getHeaderProps({ header })} key={header.key}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {dtRows.map((row, idx) => {
                const entry = rows[idx];
                if (!entry) return null;
                const tier = entry.raw.healthTier;
                return (
                  <TableRow
                    {...getRowProps({ row })}
                    key={row.id}
                    onClick={() => onRowClick(entry.raw.row.organizationId)}
                    style={{ cursor: "pointer" }}
                  >
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.info.header === "tier" ? (
                          <Tag size="sm" type={tierTag[tier]}>
                            {cell.value}
                          </Tag>
                        ) : (
                          cell.value
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataTable>
  );
}
