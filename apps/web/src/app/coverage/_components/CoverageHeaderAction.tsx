"use client";

import { ArrowRight } from "@carbon/icons-react";
import { Button } from "@carbon/react";

export function CoverageHeaderAction() {
  return (
    <Button kind="ghost" href="/coverage/mappings" renderIcon={ArrowRight} size="sm">
      Gerir mapeamentos
    </Button>
  );
}
