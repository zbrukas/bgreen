"use client";

import { deleteDomainAction } from "@/app/actions";
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
import { SortHeader } from "../_components/table-filter/SortHeader";
import { TableFilterToolbar } from "../_components/table-filter/TableFilterToolbar";
import { TablePagination } from "../_components/table-filter/TablePagination";

interface DomainRow {
  id: string;
  domain: string;
  note: string | null;
  createdAt: string;
}

interface DomainsTableProps {
  domains: DomainRow[];
  canEdit: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
}

export function DomainsTable({
  domains,
  canEdit,
  totalItems,
  page,
  pageSize,
}: DomainsTableProps) {
  return (
    <TableContainer
      title={`Domínios (${totalItems})`}
      className="border border-neutral-200 bg-white"
    >
      <TableFilterToolbar searchPlaceholder="Pesquisar por domínio ou nota" />
      <Table>
        <TableHead>
          <TableRow>
            <SortHeader sortKey="domain">Domínio</SortHeader>
            <TableHeader>Nota</TableHeader>
            <SortHeader sortKey="createdAt" defaultDir="desc">
              Adicionado
            </SortHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {domains.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-neutral-600">
                Sem domínios para o filtro actual.
              </TableCell>
            </TableRow>
          ) : (
            domains.map((d) => (
              <TableRow key={d.id}>
                <TableCell style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  {d.domain}
                </TableCell>
                <TableCell className="text-neutral-600">{d.note ?? "—"}</TableCell>
                <TableCell className="text-neutral-600">
                  {new Date(d.createdAt).toLocaleString("pt-PT")}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <form action={deleteDomainAction}>
                      <input type="hidden" name="id" value={d.id} />
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
