// Shared dimensao constants for the cell + editor.

import type { Dimensao } from "@/lib/economic-profile-types";

export const DIMENSAO_OPTIONS: Array<{ value: Dimensao; label: string }> = [
  { value: "micro", label: "MICRO" },
  { value: "pequena", label: "PEQUENA" },
  { value: "media", label: "MÉDIA" },
  { value: "grande", label: "GRANDE" },
];

export const DIMENSAO_BADGE_VARIANT: Record<Dimensao, "secondary" | "info" | "purple" | "success"> = {
  micro: "secondary",
  pequena: "info",
  media: "purple",
  grande: "success",
};
