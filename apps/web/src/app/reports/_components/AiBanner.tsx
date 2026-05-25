// Shared on all V11 report screens (matches the V9/V10 disclosure
// posture).

import { Alert } from "@/components/ui/alert";

export function AiBanner() {
  return (
    <Alert variant="info">
      Comentário gerado por IA com base nos dados submetidos — valide
      com o seu consultor.
    </Alert>
  );
}
