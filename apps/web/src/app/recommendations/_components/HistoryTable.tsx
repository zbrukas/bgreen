import {
  COMPLETENESS_LABEL,
  FEEDBACK_LABEL,
  type HistoryEntry,
  type RecommendationsStatus,
} from "@/lib/recommendations-types";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@carbon/react";
import Link from "next/link";
import { statusLabel } from "./status";

const STATUS_TAG_TYPE: Record<
  RecommendationsStatus,
  "blue" | "green" | "red" | "cool-gray"
> = {
  pending: "blue",
  running: "blue",
  ready: "green",
  failed: "red",
  cancelled: "cool-gray",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryTable({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Ainda não existem gerações para esta organização.
      </p>
    );
  }

  return (
    <TableContainer title="Histórico">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Data</TableHeader>
            <TableHeader>Perfil</TableHeader>
            <TableHeader>Estado</TableHeader>
            <TableHeader className="text-right">Itens</TableHeader>
            <TableHeader className="text-right">Úteis</TableHeader>
            <TableHeader className="text-right">Ações</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => {
            const { generation, feedbackCounts } = entry;
            const utilCount = feedbackCounts.util ?? 0;
            const itemCount = generation.recommendations?.length ?? 0;
            return (
              <TableRow key={generation.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(generation.createdAt)}
                </TableCell>
                <TableCell>{COMPLETENESS_LABEL[generation.completenessMode]}</TableCell>
                <TableCell>
                  <Tag type={STATUS_TAG_TYPE[generation.status]}>
                    {statusLabel(generation.status)}
                  </Tag>
                </TableCell>
                <TableCell className="text-right">{itemCount || "—"}</TableCell>
                <TableCell className="text-right">
                  {utilCount > 0 ? (
                    <span title={FEEDBACK_LABEL.util}>{utilCount}</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/recommendations/${generation.id}`}
                    className="text-sm font-medium text-[var(--cds-link-primary)] hover:underline"
                  >
                    Abrir
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
