"use client";

import { deleteTopicAction } from "@/app/actions";
import { TrashCan } from "@carbon/icons-react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import type { Topic } from "@bgreen/types";
import { SortHeader } from "../_components/table-filter/SortHeader";
import { TableFilterToolbar } from "../_components/table-filter/TableFilterToolbar";
import { TablePagination } from "../_components/table-filter/TablePagination";

interface TopicsTableProps {
  topics: Topic[];
  canEdit: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
}

export function TopicsTable({ topics, canEdit, totalItems, page, pageSize }: TopicsTableProps) {
  return (
    <TableContainer
      title={`Tópicos (${totalItems})`}
      className="border border-neutral-200 bg-white"
    >
      <TableFilterToolbar searchPlaceholder="Pesquisar por slug ou nome" />
      <Table>
        <TableHead>
          <TableRow>
            <SortHeader sortKey="slug">Slug</SortHeader>
            <SortHeader sortKey="name">Nome</SortHeader>
            <SortHeader sortKey="createdAt" defaultDir="desc">
              Adicionado
            </SortHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {topics.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-neutral-600">
                Sem tópicos para o filtro actual.
              </TableCell>
            </TableRow>
          ) : (
            topics.map((t) => (
              <TableRow key={t.id}>
                <TableCell style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t.slug}</TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell className="text-neutral-600">
                  {new Date(t.createdAt).toLocaleString("pt-PT")}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <form action={deleteTopicAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <Button type="submit" kind="danger--ghost" size="sm" renderIcon={TrashCan}>
                        Remover
                      </Button>
                    </form>
                  )}
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
