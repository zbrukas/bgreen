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

type TagType = "cool-gray" | "magenta";

interface InboxRow {
  id: string;
  recordId: string;
  template: string;
  state: string;
  stateLabel: string;
  stateType: TagType;
  updatedAt: string;
}

export function InboxTable({ rows }: { rows: InboxRow[] }) {
  return (
    <TableContainer
      title={`Pendentes (${rows.length})`}
      description="Cada item leva-o ao registo onde pode preencher ou corrigir."
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Modelo</TableHeader>
            <TableHeader>Acção</TableHeader>
            <TableHeader>Actualizado</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link
                  href={`/records/${r.recordId}`}
                  className="font-medium text-[var(--cds-link-primary)] hover:underline"
                >
                  {r.template}
                </Link>
              </TableCell>
              <TableCell>
                <Tag type={r.stateType}>{r.stateLabel}</Tag>
              </TableCell>
              <TableCell className="text-neutral-600">{r.updatedAt}</TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/records/${r.recordId}`}
                  className="text-sm text-[var(--cds-link-primary)] hover:underline"
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
