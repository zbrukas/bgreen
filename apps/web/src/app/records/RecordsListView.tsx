"use client";

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

type TagType = "cool-gray" | "blue" | "green" | "magenta" | "red";

interface Row {
  id: string;
  template: string;
  status: string;
  statusLabel: string;
  statusType: TagType;
  submittedAt: string;
  continueLabel: string;
}

interface RecordsListViewProps {
  isAdmin: boolean;
  pending: Row[];
  others: Row[];
}

export function RecordsListView({ isAdmin, pending, others }: RecordsListViewProps) {
  return (
    <div className="space-y-6">
      {isAdmin && (
        <RecordsTable
          title={`Pendentes de revisão${pending.length > 0 ? ` (${pending.length})` : ""}`}
          emptyMessage="Nenhum registo aguarda revisão."
          rows={pending}
          actionLabel="Rever"
        />
      )}
      <RecordsTable
        title={isAdmin ? "Restantes registos" : "Os meus registos"}
        emptyMessage="Ainda não existem registos."
        rows={others}
      />
    </div>
  );
}

function RecordsTable({
  title,
  emptyMessage,
  rows,
  actionLabel,
}: {
  title: string;
  emptyMessage: string;
  rows: Row[];
  actionLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <section>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
          {title}
        </h2>
        <p className="mt-2 text-sm text-neutral-600">{emptyMessage}</p>
      </section>
    );
  }
  return (
    <TableContainer title={title}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Modelo</TableHeader>
            <TableHeader>Estado</TableHeader>
            <TableHeader>Submetido</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link
                  href={`/records/${r.id}`}
                  className="font-medium text-[var(--cds-link-primary)] hover:underline"
                >
                  {r.template}
                </Link>
              </TableCell>
              <TableCell>
                <Tag type={r.statusType}>{r.statusLabel}</Tag>
              </TableCell>
              <TableCell className="text-neutral-600">{r.submittedAt}</TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/records/${r.id}`}
                  className="text-sm text-[var(--cds-link-primary)] hover:underline"
                >
                  {actionLabel ?? r.continueLabel}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
