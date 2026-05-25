import { InlineNotification } from "@carbon/react";
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
      <InlineNotification
        kind="error"
        title="Extração falhou"
        subtitle={message}
        lowContrast
        hideCloseButton
      />
      <div className="flex gap-2 text-sm">
        <Link
          href="/economic-profile/ies/new"
          className="text-[var(--cds-link-primary)] hover:underline"
        >
          {status === "failed_not_ies" ? "Carregar outro documento" : "Tentar novamente"}
        </Link>
        <span className="text-neutral-500">·</span>
        <Link
          href="/economic-profile/manual"
          className="text-[var(--cds-link-primary)] hover:underline"
        >
          Entrada manual
        </Link>
      </div>
    </div>
  );
}
