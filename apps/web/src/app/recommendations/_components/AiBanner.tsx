// V9 — always-visible banner on recommendation screens. PRD #19
// requires this disclosure verbatim — keep the copy in one place.

import { InlineNotification } from "@carbon/react";

export function AiBanner() {
  return (
    <InlineNotification
      kind="info"
      title="Conteúdo gerado por IA"
      subtitle="Recomendações geradas por IA — valide com o seu consultor."
      lowContrast
      hideCloseButton
    />
  );
}
