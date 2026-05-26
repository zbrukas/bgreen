"use client";

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
import { FilterSelect } from "../_components/table-filter/FilterSelect";
import { SortHeader } from "../_components/table-filter/SortHeader";
import { TableFilterToolbar } from "../_components/table-filter/TableFilterToolbar";
import { TablePagination } from "../_components/table-filter/TablePagination";

interface OrgRow {
  id: string;
  name: string;
  nif: string | null;
  caeCode: string | null;
  distrito: string | null;
  memberCount: number;
  adminCount: number;
  createdAt: string;
}

interface OrgsTableProps {
  rows: OrgRow[];
  distritos: string[];
  totalItems: number;
  page: number;
  pageSize: number;
}

export function OrgsTable({ rows, distritos, totalItems, page, pageSize }: OrgsTableProps) {
  return (
    <TableContainer
      title={`Organizações (${totalItems})`}
      className="border border-neutral-200 bg-white"
    >
      <TableFilterToolbar searchPlaceholder="Pesquisar por nome, NIF ou distrito">
        {distritos.length > 0 && (
          <FilterSelect
            paramKey="distrito"
            label="Distrito"
            allLabel="Todos os distritos"
            options={distritos.map((d) => ({ value: d, label: d }))}
          />
        )}
      </TableFilterToolbar>
      <Table aria-label="Organizações">
        <TableHead>
          <TableRow>
            <SortHeader sortKey="name">Nome</SortHeader>
            <TableHeader>NIF</TableHeader>
            <TableHeader>CAE</TableHeader>
            <TableHeader>Membros</TableHeader>
            <TableHeader>Admins</TableHeader>
            <SortHeader sortKey="createdAt" defaultDir="desc">
              Criada
            </SortHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-neutral-600">
                Sem organizações para o filtro actual.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Link
                    href={`/orgs/${entry.id}`}
                    className="text-[--cds-link-primary] underline"
                  >
                    {entry.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono">{entry.nif ?? "—"}</TableCell>
                <TableCell className="font-mono">{entry.caeCode ?? "—"}</TableCell>
                <TableCell>{entry.memberCount}</TableCell>
                <TableCell>{entry.adminCount}</TableCell>
                <TableCell>
                  {new Date(entry.createdAt).toLocaleDateString("pt-PT")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <TablePagination totalItems={totalItems} page={page} pageSize={pageSize} />
    </TableContainer>
  );
}
