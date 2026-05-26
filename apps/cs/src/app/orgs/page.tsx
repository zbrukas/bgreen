import { EmptyState, PageHeader } from "@bgreen/ui";
import { Building } from "@carbon/icons-react";
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
import { redirect } from "next/navigation";
import { fetchCsOrgs, fetchMe } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function OrgsPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");
  if (me.userType !== "central_services") redirect("/");

  const orgs = await fetchCsOrgs();

  return (
    <>
      <PageHeader
        title="Organizações"
        description="Todas as organizações geridas. Clique para ver membros."
        icon={Building}
      />
      <div className="space-y-6 px-8 py-6">
        {orgs.length === 0 ? (
          <EmptyState
            title="Sem organizações"
            description="Nenhuma organização foi criada ainda. Aparecerão aqui assim que existam."
          />
        ) : (
          <TableContainer>
            <Table aria-label="Organizações">
              <TableHead>
                <TableRow>
                  <TableHeader>Nome</TableHeader>
                  <TableHeader>NIF</TableHeader>
                  <TableHeader>CAE</TableHeader>
                  <TableHeader>Membros</TableHeader>
                  <TableHeader>Admins</TableHeader>
                  <TableHeader>Criada</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {orgs.map((entry) => (
                  <TableRow key={entry.organization.id}>
                    <TableCell>
                      <Link
                        href={`/orgs/${entry.organization.id}`}
                        className="text-[--cds-link-primary] underline"
                      >
                        {entry.organization.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">
                      {entry.organization.nif ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {entry.organization.caeCode ?? "—"}
                    </TableCell>
                    <TableCell>{entry.memberCount}</TableCell>
                    <TableCell>{entry.adminCount}</TableCell>
                    <TableCell>
                      {new Date(entry.organization.createdAt).toLocaleDateString("pt-PT")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </>
  );
}
