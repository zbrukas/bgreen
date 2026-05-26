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
import { FilterSelect } from "../_components/table-filter/FilterSelect";
import { SortHeader } from "../_components/table-filter/SortHeader";
import { TableFilterToolbar } from "../_components/table-filter/TableFilterToolbar";
import { TablePagination } from "../_components/table-filter/TablePagination";

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

interface TemplatesTableProps {
  rows: TemplateRow[];
  totalItems: number;
  page: number;
  pageSize: number;
}

export function TemplatesTable({ rows, totalItems, page, pageSize }: TemplatesTableProps) {
  return (
    <TableContainer
      title={`Modelos (${totalItems})`}
      className="border border-neutral-200 bg-white"
    >
      <TableFilterToolbar searchPlaceholder="Pesquisar por nome ou descrição">
        <FilterSelect
          paramKey="status"
          label="Estado"
          options={[
            { value: "draft", label: "Rascunho" },
            { value: "published", label: "Publicado" },
            { value: "archived", label: "Arquivado" },
          ]}
        />
        <FilterSelect
          paramKey="sub"
          label="Sub-template"
          options={[
            { value: "yes", label: "Apenas sub-templates" },
            { value: "no", label: "Apenas modelos principais" },
          ]}
        />
      </TableFilterToolbar>
      <Table>
        <TableHead>
          <TableRow>
            <SortHeader sortKey="name">Nome</SortHeader>
            <SortHeader sortKey="status">Estado</SortHeader>
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
      <TablePagination totalItems={totalItems} page={page} pageSize={pageSize} />
    </TableContainer>
  );
}
