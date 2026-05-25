import { Header } from "@/app/_components/Header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { listProfiles } from "@/lib/economic-profile-actions";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DimensaoCell } from "./DimensaoCell";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<OrganizationEconomicProfile["source"], string> = {
  ies_extracted: "IES",
  edited_after_extraction: "IES (editado)",
  manual: "Manual",
};

// EUR formatter — pt-PT locale: vírgula decimal, espaço como separador.
const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return EUR.format(value);
}

export default async function EconomicProfilePage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);
  if (!activeOrgId) redirect("/");

  const profiles = await listProfiles().catch(() => [] as OrganizationEconomicProfile[]);

  return (
    <>
      <Header
        userEmail={auth.user.email}
        organizations={orgs}
        activeOrganizationId={activeOrgId}
        activeOrganizationRole={me?.activeOrganizationRole ?? null}
      />
      <main className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Perfil económico</h1>
            <p className="text-sm text-muted-foreground">
              Dados económicos por exercício. Carregue um IES para extrair automaticamente, ou
              introduza os valores manualmente.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/economic-profile/ies/new"
              className={buttonVariants({ size: "sm" })}
            >
              Carregar IES
            </Link>
            <Link
              href="/economic-profile/manual"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Entrada manual
            </Link>
          </div>
        </div>

        {profiles.length === 0 ? <EmptyState /> : <ProfileTable profiles={profiles} />}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sem dados económicos ainda</CardTitle>
        <CardDescription>
          Carregue o seu IES para desbloquear recomendações e comparações setoriais.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Link href="/economic-profile/ies/new" className={buttonVariants()}>
          Carregar IES
        </Link>
        <Link
          href="/economic-profile/manual"
          className={buttonVariants({ variant: "outline" })}
        >
          Entrada manual
        </Link>
      </CardContent>
    </Card>
  );
}

function ProfileTable({ profiles }: { profiles: OrganizationEconomicProfile[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano</TableHead>
              <TableHead>Colaboradores</TableHead>
              <TableHead>Volume de negócios</TableHead>
              <TableHead>EBITDA</TableHead>
              <TableHead>Ativo total</TableHead>
              <TableHead>CAE</TableHead>
              <TableHead>Dimensão</TableHead>
              <TableHead>Fonte</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.year}</TableCell>
                <TableCell>{p.employees ?? "—"}</TableCell>
                <TableCell>{formatMoney(p.turnover)}</TableCell>
                <TableCell>{formatMoney(p.ebitda)}</TableCell>
                <TableCell>{formatMoney(p.balanceSheetTotal)}</TableCell>
                <TableCell>{p.cae ?? "—"}</TableCell>
                <TableCell>
                  <DimensaoCell profile={p} />
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{SOURCE_LABEL[p.source]}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
