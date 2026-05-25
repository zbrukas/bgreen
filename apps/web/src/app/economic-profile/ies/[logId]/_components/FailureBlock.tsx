import { Alert } from "@/components/ui/alert";
import Link from "next/link";

export function FailureBlock({
  message,
  status,
}: {
  message: string;
  status: "failed_not_ies" | "failed_extraction" | "failed_validation";
}) {
  return (
    <div className="space-y-3">
      <Alert variant="destructive">{message}</Alert>
      <div className="flex gap-2">
        <Link href="/economic-profile/ies/new" className="text-sm underline">
          {status === "failed_not_ies" ? "Carregar outro documento" : "Tentar novamente"}
        </Link>
        <span className="text-sm text-muted-foreground">·</span>
        <Link href="/economic-profile/manual" className="text-sm underline">
          Entrada manual
        </Link>
      </div>
    </div>
  );
}
