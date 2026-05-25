import { InlineNotification } from "@carbon/react";

export function AiBanner() {
  return (
    <InlineNotification
      kind="info"
      title="Conteúdo gerado por IA"
      subtitle="Explicações geradas por IA — valide com o seu consultor."
      lowContrast
      hideCloseButton
    />
  );
}
