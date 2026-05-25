"use client";

// Per-year dimensao cell in the /economic-profile list table.
//
// States:
//   - profile.dimensao === null: shows "Classificar" button → opens
//     DimensaoEditor which fetches the proposal + lets the user accept
//     or override.
//   - profile.dimensao !== null: shows the DIMENSAO badge + small
//     "Alterar" link that reopens the editor.
//
// Confirmation invalidates the profile list query so the parent table
// refreshes without a manual reload.

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DIMENSAO_LABEL,
  type OrganizationEconomicProfile,
} from "@/lib/economic-profile-types";
import { useState } from "react";
import { DimensaoEditor } from "./_components/DimensaoEditor";
import { DIMENSAO_BADGE_VARIANT } from "./_components/dimensao-options";

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
