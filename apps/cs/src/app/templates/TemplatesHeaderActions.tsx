"use client";

import { Add } from "@carbon/icons-react";
import { Button } from "@carbon/react";

export function TemplatesHeaderActions() {
  return (
    <Button kind="primary" href="/templates/new" renderIcon={Add} size="sm">
      Novo modelo
    </Button>
  );
}
