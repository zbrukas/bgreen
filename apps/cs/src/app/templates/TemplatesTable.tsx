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
  isSubTemplate: boolean;
  fieldCount: number;
}

export function TemplatesTable({ rows }: { rows: TemplateRow[] }) {
  return (
    <TableContainer title={`Modelos (${rows.length})`}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Nome</TableHeader>
            <TableHeader>Estado</TableHeader>
            <TableHeader>Sub-template</TableHeader>
            <TableHeader>Campos</TableHeader>
            <TableHeader />
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
              <TableCell className="text-neutral-600">
                {tpl.isSubTemplate ? "Sim" : "—"}
              </TableCell>
              <TableCell className="text-neutral-600">{tpl.fieldCount}</TableCell>
              <TableCell className="text-right text-sm">
                <Link
                  href={`/templates/${tpl.id}`}
                  className="text-[var(--cds-link-primary)] hover:underline"
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
