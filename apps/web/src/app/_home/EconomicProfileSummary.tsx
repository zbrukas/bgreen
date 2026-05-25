"use client";

import { StatCard } from "@/components/shell/StatCard";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import { ArrowRight, Calendar, Money, UserMultiple } from "@carbon/icons-react";
import { Button } from "@carbon/react";

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
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2
            style={{ fontSize: "1.25rem", fontWeight: 400, lineHeight: 1.28, margin: 0 }}
          >
            Perfil económico
          </h2>
          <p className="mt-0.5 text-sm text-neutral-600">
            {count === 1
              ? "1 exercício registado."
              : `${count} exercícios registados. Mais recente: ${profile.year}.`}
          </p>
        </div>
        <Button kind="ghost" href="/economic-profile" renderIcon={ArrowRight} size="sm">
          Ver perfil completo
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Ano" value={String(profile.year)} icon={Calendar} />
        <StatCard
          label="Colaboradores"
          value={profile.employees !== null ? String(profile.employees) : "—"}
          icon={UserMultiple}
        />
        <StatCard
          label="Volume de negócios"
          value={profile.turnover === null ? "—" : EUR.format(profile.turnover)}
          icon={Money}
        />
      </div>
    </section>
  );
}
