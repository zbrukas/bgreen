"use client";

import { startRecommendations } from "@/lib/recommendations-actions";
import { Recommend } from "@carbon/icons-react";
import { Button, InlineNotification } from "@carbon/react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface GerarButtonProps {
  label?: string;
  kind?: "primary" | "tertiary";
}

export function GerarButton({ label = "Gerar recomendações", kind = "primary" }: GerarButtonProps) {
  const router = useRouter();
  const start = useMutation({
    mutationFn: () => startRecommendations(),
    onSuccess: (row) => {
      router.push(`/recommendations/${row.id}`);
    },
  });
  return (
    <div className="space-y-2">
      <Button
        kind={kind}
        onClick={() => start.mutate()}
        disabled={start.isPending}
        renderIcon={Recommend}
        size="sm"
      >
        {start.isPending ? "A iniciar…" : label}
      </Button>
      {start.isError ? (
        <InlineNotification
          kind="error"
          title="Não foi possível iniciar"
          subtitle="A geração falhou. Tente novamente."
          lowContrast
          hideCloseButton
        />
      ) : null}
    </div>
  );
}
