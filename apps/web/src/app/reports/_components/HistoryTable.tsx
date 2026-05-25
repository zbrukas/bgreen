import { type ReportInstance, TEMPLATE_LABEL } from "@/lib/reports-types";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

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

function formatPeriod(start: string, end: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  return `${fmt(start)} → ${fmt(end)}`;
}

export function HistoryTable({ reports }: { reports: ReportInstance[] }) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Ainda não existem relatórios para esta organização.
      </p>
    );
  }

  return (
    <TableContainer title="Histórico">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Data</TableHeader>
            <TableHeader>Modelo</TableHeader>
            <TableHeader>Período</TableHeader>
            <TableHeader>Estado</TableHeader>
            <TableHeader className="text-right">Ações</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell className="whitespace-nowrap">
                {formatDateTime(report.createdAt)}
              </TableCell>
              <TableCell>{TEMPLATE_LABEL[report.templateId]}</TableCell>
              <TableCell className="whitespace-nowrap text-neutral-600">
                {formatPeriod(report.periodStart, report.periodEnd)}
              </TableCell>
              <TableCell>
                <StatusBadge status={report.status} />
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/reports/${report.id}`}
                  className="text-sm font-medium text-[var(--cds-link-primary)] hover:underline"
                >
                  Abrir
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
