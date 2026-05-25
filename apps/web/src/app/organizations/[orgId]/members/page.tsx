import { EmptyState } from "@bgreen/ui";
import { PageHeader } from "@bgreen/ui";
import { fetchMe, fetchMembers } from "@/lib/api-client";
import { Add, UserMultiple } from "@carbon/icons-react";
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
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MembersHeaderActions } from "./MembersHeaderActions";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  org_admin: "Administrador",
  org_user_write: "Membro",
  org_user_read: "Leitor",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function MembersPage({ params }: PageProps) {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const { orgId } = await params;
  const me = await fetchMe();
  if (!me || me.activeOrganizationId !== orgId || me.activeOrganizationRole !== "org_admin") {
    return (
      <>
        <PageHeader
          title="Acesso restrito"
          description="Apenas administradores da organização activa podem ver os membros."
          icon={UserMultiple}
        />
      </>
    );
  }

  const members = await fetchMembers(orgId);

  return (
    <>
      <PageHeader
        title="Membros"
        description="Defina o papel e o âmbito de tópicos de cada membro da organização."
        icon={UserMultiple}
        actions={<MembersHeaderActions orgId={orgId} />}
      />
      <div className="space-y-6 px-8 py-6">
        {members.length === 0 ? (
          <EmptyState
            title="Sem membros ainda"
            description="Convide a primeira pessoa para começar a colaborar."
            primaryAction={{
              label: "Convidar membro",
              href: `/organizations/${orgId}/invites/new`,
              icon: Add,
            }}
          />
        ) : (
          <TableContainer title={`Membros (${members.length})`}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Membro</TableHeader>
                  <TableHeader>Papel</TableHeader>
                  <TableHeader>Âmbito</TableHeader>
                  <TableHeader className="text-right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <div className="font-medium">{m.user?.email ?? m.userId.slice(0, 8)}</div>
                      {(m.user?.firstName || m.user?.lastName) && (
                        <div className="text-xs text-neutral-600">
                          {[m.user.firstName, m.user.lastName].filter(Boolean).join(" ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tag type="cool-gray" size="sm">
                        {roleLabel[m.role] ?? m.role}
                      </Tag>
                    </TableCell>
                    <TableCell>
                      {m.topicScope.length === 0 ? (
                        <span className="text-xs text-neutral-600">— todos os tópicos —</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {m.topicScope.map((slug) => (
                            <Tag
                              key={slug}
                              type="blue"
                              size="sm"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                              {slug}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/organizations/${orgId}/members/${m.userId}`}
                        className="text-sm text-[var(--cds-link-primary)] hover:underline"
                      >
                        Editar
                      </Link>
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
