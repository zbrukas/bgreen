"use client";

// Per-year dimensao cell in the /economic-profile list table.
//
// States:
//   - profile.dimensao === null: shows "Classificar" button → fetches
//     proposal via useQuery (suspended until clicked, via `enabled`),
//     renders the proposed band + rationale + override dropdown + confirm.
//   - profile.dimensao !== null: shows the DIMENSAO badge + small
//     "Alterar" link that reopens the override flow.
//
// Confirmation invalidates the profile list query so the parent table
// refreshes without a manual reload.

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  confirmDimensao,
  getDimensaoProposal,
} from "@/lib/economic-profile-actions";
import {
  DIMENSAO_LABEL,
  type Dimensao,
  type OrganizationEconomicProfile,
} from "@/lib/economic-profile-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const DIMENSAO_OPTIONS: Array<{ value: Dimensao; label: string }> = [
  { value: "micro", label: "MICRO" },
  { value: "pequena", label: "PEQUENA" },
  { value: "media", label: "MÉDIA" },
  { value: "grande", label: "GRANDE" },
];

const DIMENSAO_BADGE_VARIANT: Record<Dimensao, "secondary" | "info" | "purple" | "success"> = {
  micro: "secondary",
  pequena: "info",
  media: "purple",
  grande: "success",
};

export function DimensaoCell({ profile }: { profile: OrganizationEconomicProfile }) {
  const [editing, setEditing] = useState(false);

  if (!editing && profile.dimensao !== null) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={DIMENSAO_BADGE_VARIANT[profile.dimensao]}>
          {DIMENSAO_LABEL[profile.dimensao]}
        </Badge>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setEditing(true)}
        >
          Alterar
        </button>
      </div>
    );
  }

  if (!editing) {
    return (
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        Classificar
      </Button>
    );
  }

  return (
    <DimensaoEditor
      profile={profile}
      onDone={() => setEditing(false)}
      onCancel={() => setEditing(false)}
    />
  );
}

function DimensaoEditor({
  profile,
  onDone,
  onCancel,
}: {
  profile: OrganizationEconomicProfile;
  onDone: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["dimensao-proposal", profile.organizationId, profile.year],
    queryFn: () => getDimensaoProposal(profile.year),
    staleTime: 0,
  });

  const [override, setOverride] = useState<Dimensao | null>(profile.dimensao);

  // When the proposal arrives, default the dropdown to the proposed
  // value if the user hasn't picked something else yet. Editing an
  // already-confirmed profile defaults to the persisted dimensao.
  if (override === null && query.data) {
    setOverride(query.data.proposal.dimensao);
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (override === null) {
        return Promise.reject(new Error("dimensao_required"));
      }
      const proposed = query.data?.proposal.dimensao;
      return confirmDimensao({
        year: profile.year,
        dimensao: override,
        source: override === proposed ? "ai_classified" : "user_override",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["economic-profiles"] });
      qc.invalidateQueries({
        queryKey: ["dimensao-proposal", profile.organizationId, profile.year],
      });
      onDone();
    },
  });

  if (query.isLoading) {
    return <p className="text-xs text-muted-foreground">A classificar…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <div className="space-y-1 text-xs">
        <p className="text-red-700">Não foi possível classificar.</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Fechar
        </button>
      </div>
    );
  }

  const { proposal } = query.data;
  const confidence = proposal.confidence.level;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Proposta:</span>
        <Badge variant={DIMENSAO_BADGE_VARIANT[proposal.dimensao]}>
          {DIMENSAO_LABEL[proposal.dimensao]}
        </Badge>
        {confidence !== "high" ? (
          <span className="text-amber-700">
            confiança {confidence === "medium" ? "média" : "baixa"}
          </span>
        ) : null}
      </div>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {proposal.rationale.map((r) => (
          <li key={r.rule}>· {r.message}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Dimensão"
          value={override ?? proposal.dimensao}
          onChange={(e) => setOverride(e.target.value as Dimensao)}
          className="w-32"
        >
          {DIMENSAO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "A guardar…" : "Confirmar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
          Fechar
        </Button>
      </div>
      {mutation.isError ? (
        <p className="text-xs text-red-700">
          Não foi possível guardar. Tente novamente.
        </p>
      ) : null}
    </div>
  );
}
