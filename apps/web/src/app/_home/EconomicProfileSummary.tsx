import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import Link from "next/link";

// pt-PT money formatter — vírgula decimal, espaço como separador.
const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function EconomicProfileSummary({
  profile,
  count,
}: {
  profile: OrganizationEconomicProfile;
  count: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil económico</CardTitle>
        <CardDescription>
          {count === 1
            ? `1 exercício registado.`
            : `${count} exercícios registados. Mais recente: ${profile.year}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Ano</div>
          <div className="font-medium">{profile.year}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Colaboradores</div>
          <div className="font-medium">{profile.employees ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Volume de negócios</div>
          <div className="font-medium">
            {profile.turnover === null ? "—" : EUR.format(profile.turnover)}
          </div>
        </div>
        <div className="sm:col-span-3">
          <Link
            href="/economic-profile"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Ver perfil económico completo →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
