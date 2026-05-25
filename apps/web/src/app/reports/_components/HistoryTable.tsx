import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ReportInstance,
  TEMPLATE_LABEL,
} from "@/lib/reports-types";
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
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ainda não existem relatórios para esta organização.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(report.createdAt)}
                </TableCell>
                <TableCell>{TEMPLATE_LABEL[report.templateId]}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatPeriod(report.periodStart, report.periodEnd)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={report.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/reports/${report.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Abrir
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
