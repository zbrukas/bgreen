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

type TagType = "cool-gray" | "green" | "warm-gray";

interface TemplateRow {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  statusType: TagType;
  fieldCount: number;
}

export function TemplatesTable({ rows }: { rows: TemplateRow[] }) {
  return (
    <TableContainer title="Modelos publicados">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Nome</TableHeader>
            <TableHeader>Estado</TableHeader>
            <TableHeader>Campos</TableHeader>
            <TableHeader className="text-right">Acções</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((tpl) => (
            <TableRow key={tpl.id}>
              <TableCell>
                <Link
                  href={`/templates/${tpl.id}`}
                  className="font-medium text-[var(--cds-link-primary)] hover:underline"
                >
                  {tpl.name}
                </Link>
              </TableCell>
              <TableCell>
                <Tag type={tpl.statusType}>{tpl.statusLabel}</Tag>
              </TableCell>
              <TableCell className="text-neutral-600">{tpl.fieldCount}</TableCell>
              <TableCell className="text-right text-sm">
                <Link
                  href={`/records/new?template=${tpl.id}`}
                  className="mr-3 text-[var(--cds-link-primary)] hover:underline"
                >
                  Submeter
                </Link>
                <Link
                  href={`/templates/${tpl.id}`}
                  className="text-neutral-600 hover:text-neutral-900 hover:underline"
                >
                  Ver
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
