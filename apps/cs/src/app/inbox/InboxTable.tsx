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

interface InboxRow {
  id: string;
  entityId: string;
  state: string;
  updatedAt: string;
}

export function InboxTable({ rows }: { rows: InboxRow[] }) {
  return (
    <TableContainer
      title={`Pendentes (${rows.length})`}
      description="Cada item leva-o ao registo para rever."
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Modelo / registo</TableHeader>
            <TableHeader>Estado</TableHeader>
            <TableHeader>Actualizado</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link
                  href={`/records/${r.entityId}`}
                  className="font-medium text-[var(--cds-link-primary)] hover:underline"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8125rem" }}
                >
                  {r.entityId.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell>
                <Tag type="blue">{r.state}</Tag>
              </TableCell>
              <TableCell className="text-neutral-600">{r.updatedAt}</TableCell>
              <TableCell className="text-right text-sm">
                <Link
                  href={`/records/${r.entityId}`}
                  className="text-[var(--cds-link-primary)] hover:underline"
                >
                  Rever
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
