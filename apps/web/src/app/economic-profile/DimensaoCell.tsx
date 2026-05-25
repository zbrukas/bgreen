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

import {
  DIMENSAO_LABEL,
  type OrganizationEconomicProfile,
} from "@/lib/economic-profile-types";
import { Button, Tag } from "@carbon/react";
import { useState } from "react";
import { DimensaoEditor } from "./_components/DimensaoEditor";
import { DIMENSAO_TAG_TYPE } from "./_components/dimensao-options";

export function DimensaoCell({ profile }: { profile: OrganizationEconomicProfile }) {
  const [editing, setEditing] = useState(false);

  if (!editing && profile.dimensao !== null) {
    return (
      <div className="flex items-center gap-2">
        <Tag type={DIMENSAO_TAG_TYPE[profile.dimensao]}>{DIMENSAO_LABEL[profile.dimensao]}</Tag>
        <button
          type="button"
          className="text-xs text-neutral-600 hover:underline"
          onClick={() => setEditing(true)}
        >
          Alterar
        </button>
      </div>
    );
  }

  if (!editing) {
    return (
      <Button size="sm" kind="tertiary" onClick={() => setEditing(true)}>
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
