"use client";

import { Add } from "@carbon/icons-react";
import { Button } from "@carbon/react";

export function MembersHeaderActions({ orgId }: { orgId: string }) {
  return (
    <Button
      kind="primary"
      href={`/organizations/${orgId}/invites/new`}
      renderIcon={Add}
      size="sm"
    >
      Convidar
    </Button>
  );
}
