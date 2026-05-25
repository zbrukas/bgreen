import { Badge } from "@/components/ui/badge";
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
  COMPLETENESS_LABEL,
  FEEDBACK_LABEL,
  type HistoryEntry,
  type RecommendationsStatus,
} from "@/lib/recommendations-types";
import Link from "next/link";
import { statusLabel } from "./status";

const STATUS_BADGE: Record<RecommendationsStatus, "info" | "warning" | "success" | "destructive" | "secondary"> = {
  pending: "info",
  running: "info",
  ready: "success",
  failed: "destructive",
  cancelled: "secondary",
};

function formatDateTime(iso: string): string {
  // pt-PT-friendly compact format. The user sees the locale's date plus
  // hour:minute — enough to disambiguate same-day regens.
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
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ainda não existem gerações para esta organização.
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
              <TableHead>Perfil</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Úteis</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
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
                    <Badge variant={STATUS_BADGE[generation.status]}>
                      {statusLabel(generation.status)}
                    </Badge>
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
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Abrir
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
