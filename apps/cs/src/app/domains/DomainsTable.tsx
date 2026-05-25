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

interface DomainRow {
  id: string;
  domain: string;
  note: string | null;
  createdAt: string;
}

export function DomainsTable({ domains, canEdit }: { domains: DomainRow[]; canEdit: boolean }) {
  if (domains.length === 0) {
    return <p className="text-sm text-neutral-600">Sem domínios registados.</p>;
  }
  return (
    <TableContainer title={`Domínios (${domains.length})`}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Domínio</TableHeader>
            <TableHeader>Nota</TableHeader>
            <TableHeader>Adicionado</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {domains.map((d) => (
            <TableRow key={d.id}>
              <TableCell style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{d.domain}</TableCell>
              <TableCell className="text-neutral-600">{d.note ?? "—"}</TableCell>
              <TableCell className="text-neutral-600">
                {new Date(d.createdAt).toLocaleString("pt-PT")}
              </TableCell>
              <TableCell className="text-right">
                {canEdit && (
                  <form action={deleteDomainAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <Button type="submit" kind="ghost" size="sm" renderIcon={TrashCan}>
                      Remover
                    </Button>
                  </form>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
