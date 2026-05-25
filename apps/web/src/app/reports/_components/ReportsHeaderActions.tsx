"use client";

import { Add } from "@carbon/icons-react";
import { Button } from "@carbon/react";

export function ReportsHeaderActions() {
  return (
    <Button kind="primary" href="/reports/new" renderIcon={Add} size="sm">
      Gerar relatório
    </Button>
  );
}
