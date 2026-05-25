"use client";

import { ChartLineSmooth, DocumentBlank, Upload } from "@carbon/icons-react";
import { Button } from "@carbon/react";

export function ProfileActions() {
  return (
    <>
      <Button kind="ghost" href="/economic-profile/trend" renderIcon={ChartLineSmooth} size="sm">
        Tendências
      </Button>
      <Button kind="tertiary" href="/economic-profile/manual" renderIcon={DocumentBlank} size="sm">
        Manual
      </Button>
      <Button kind="primary" href="/economic-profile/ies/new" renderIcon={Upload} size="sm">
        Carregar IES
      </Button>
    </>
  );
}
