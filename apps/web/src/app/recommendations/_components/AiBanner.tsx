// V9 — always-visible banner on recommendation screens. PRD #19
// requires this disclosure verbatim ("Recomendações geradas por IA —
// valide com o seu consultor.") — keep the copy in one place.

import { Alert } from "@/components/ui/alert";

export function AiBanner() {
  return (
    <Alert variant="info">
      Recomendações geradas por IA — valide com o seu consultor.
    </Alert>
  );
}
