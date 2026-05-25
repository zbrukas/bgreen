import { InlineNotification } from "@carbon/react";

export function AiBanner() {
  return (
    <InlineNotification
      kind="info"
      title="Conteúdo gerado por IA"
      subtitle="Comentário gerado por IA com base nos dados submetidos — valide com o seu consultor."
      lowContrast
      hideCloseButton
    />
  );
}
