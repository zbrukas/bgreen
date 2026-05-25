"use client";

import { ArrowRight } from "@carbon/icons-react";
import { Button, InlineNotification } from "@carbon/react";

export function ConfirmedBlock({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-3">
      <InlineNotification
        kind="success"
        title="Perfil económico guardado"
        subtitle="Os dados extraídos foram confirmados."
        lowContrast
        hideCloseButton
      />
      <Button kind="primary" onClick={onContinue} renderIcon={ArrowRight}>
        Ver perfil económico
      </Button>
    </div>
  );
}
