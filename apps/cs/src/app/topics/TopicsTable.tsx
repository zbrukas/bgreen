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

export function TopicsTable({ topics, canEdit }: { topics: Topic[]; canEdit: boolean }) {
  if (topics.length === 0) {
    return <p className="text-sm text-neutral-600">Sem tópicos registados.</p>;
  }
  return (
    <TableContainer title={`Tópicos (${topics.length})`}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Slug</TableHeader>
            <TableHeader>Nome</TableHeader>
            <TableHeader>Adicionado</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {topics.map((t) => (
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
