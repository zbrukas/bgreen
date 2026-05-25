"use client";

// Fires a startRecommendations mutation and routes to /recommendations/:id
// on success so the user sees the polling page. PRD acceptance criterion:
// "Loading state during Inngest run" — the button shows "A iniciar…"
// during the brief queue-and-redirect window.

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startRecommendations } from "@/lib/recommendations-actions";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface GerarButtonProps {
  label?: string;
  variant?: "default" | "outline";
}

export function GerarButton({ label = "Gerar recomendações", variant = "default" }: GerarButtonProps) {
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
        onClick={() => start.mutate()}
        disabled={start.isPending}
        variant={variant}
      >
        {start.isPending ? "A iniciar…" : label}
      </Button>
      {start.isError ? (
        <Alert variant="destructive">
          Não foi possível iniciar a geração. Tente novamente.
        </Alert>
      ) : null}
    </div>
  );
}
