import { PageHeader } from "@bgreen/ui";
import { Building } from "@carbon/icons-react";
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
import { notFound, redirect } from "next/navigation";
import { fetchCsOrgDetail, fetchMe, type OrgMember } from "@/lib/api-client";
import { DeleteOrgButton } from "./DeleteOrgButton";
import { OrgEditor } from "./OrgEditor";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<OrgMember["role"], string> = {
  org_admin: "Admin",
  org_user_write: "Editor",
  org_user_read: "Leitor",
};

const ROLE_TAG: Record<OrgMember["role"], "purple" | "blue" | "cool-gray"> = {
  org_admin: "purple",
  org_user_write: "blue",
  org_user_read: "cool-gray",
};

interface OrgDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrgDetailPage({ params }: OrgDetailPageProps) {
  const me = await fetchMe();
  if (!me) redirect("/login");
  if (me.userType !== "central_services") redirect("/");

  const { id } = await params;
  const detail = await fetchCsOrgDetail(id);
  if (!detail) notFound();

  // canCsWrite = admin OR maintainer. Promoter is publish-only and
  // doesn't get destructive ops on customer data.
  const canDelete =
    me.centralServicesRole === "admin" || me.centralServicesRole === "maintainer";

  const admins = detail.members.filter((m) => m.role === "org_admin");

  return (
    <>
      <PageHeader
        title={detail.organization.name}
        description={`${detail.members.length} membros · ${admins.length} admins · NIF ${detail.organization.nif ?? "—"}`}
        icon={Building}
        breadcrumbs={[
          { label: "Organizações", href: "/orgs" },
          { label: detail.organization.name },
        ]}
      />
      <div className="space-y-10 px-8 py-8">
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[--cds-text-secondary]">
            Detalhes
          </h2>
          <OrgEditor organization={detail.organization} />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[--cds-text-secondary]">
            Membros ({detail.members.length})
          </h2>
          {detail.members.length === 0 ? (
            <p className="text-sm text-[--cds-text-secondary]">
              Esta organização ainda não tem membros.
            </p>
          ) : (
            <TableContainer>
              <Table aria-label="Membros">
                <TableHead>
                  <TableRow>
                    <TableHeader>Email</TableHeader>
                    <TableHeader>Nome</TableHeader>
                    <TableHeader>Papel</TableHeader>
                    <TableHeader>Tópicos</TableHeader>
                    <TableHeader>Membro desde</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.members.map((m) => (
                    <TableRow key={m.userId}>
                      <TableCell className="font-mono text-xs">{m.email}</TableCell>
                      <TableCell>
                        {[m.firstName, m.lastName].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Tag size="sm" type={ROLE_TAG[m.role]}>
                          {ROLE_LABEL[m.role]}
                        </Tag>
                      </TableCell>
                      <TableCell>
                        {m.topicScope.length === 0 ? "Todos" : m.topicScope.join(", ")}
                      </TableCell>
                      <TableCell>
                        {new Date(m.createdAt).toLocaleDateString("pt-PT")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </section>

        <section className="border-t border-[--cds-border-subtle] pt-6">
          <Link
            href="/health"
            className="text-sm text-[--cds-link-primary] underline"
          >
            Ver saúde de Customer Success para esta organização →
          </Link>
        </section>

        {canDelete && (
          <section className="border-t border-[--cds-border-subtle] pt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[--cds-text-secondary]">
              Zona perigosa
            </h2>
            <p className="mb-4 text-sm text-[--cds-text-secondary]">
              A eliminação remove em cascata registos, workflows, perfis económicos
              e relatórios desta organização. Ação irreversível.
            </p>
            <DeleteOrgButton
              organizationId={detail.organization.id}
              organizationName={detail.organization.name}
            />
          </section>
        )}
      </div>
    </>
  );
}
