import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ConfirmedBlock({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-3">
      <Alert variant="success">Perfil económico guardado com sucesso.</Alert>
      <Button onClick={onContinue}>Ver perfil económico</Button>
    </div>
  );
}
