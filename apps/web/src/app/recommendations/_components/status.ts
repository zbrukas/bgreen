// pt-PT vocabulary for recommendation generation states. Imported by
// HistoryTable + the detail page header so the wording stays in sync.

import type { RecommendationsStatus } from "@/lib/recommendations-types";

const LABEL: Record<RecommendationsStatus, string> = {
  pending: "Em fila",
  running: "Em curso",
  ready: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export function statusLabel(status: RecommendationsStatus): string {
  return LABEL[status];
}
