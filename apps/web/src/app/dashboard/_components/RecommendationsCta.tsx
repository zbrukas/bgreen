"use client";

import { Recommend } from "@carbon/icons-react";
import { Button, Tile } from "@carbon/react";

// PRD acceptance: "Preliminary recommendations work for INCOMPLETE-mode
// users: as soon as signup wizard (V3) completes, a 'ver recomendações
// preliminares' CTA is available."
//
// `mode` controls which copy + label we render:
//   - "preliminary" → preliminary CTA for INCOMPLETE-mode orgs.
//   - "full"        → standard CTA for orgs with confirmed data.

export function RecommendationsCta({ mode }: { mode: "preliminary" | "full" }) {
  const title = mode === "preliminary" ? "Recomendações preliminares" : "Recomendações ESG";
  const description =
    mode === "preliminary"
      ? "Já pode obter recomendações genéricas adaptadas à sua dimensão e setor. Carregue o IES para sugestões mais específicas."
      : "Gere recomendações accionáveis baseadas no seu perfil económico e registos ESG.";
  const cta = mode === "preliminary" ? "Ver recomendações preliminares" : "Gerar recomendações";

  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>{title}</h2>
      <p className="mt-1 text-sm text-neutral-700">{description}</p>
      <div className="mt-4">
        <Button kind="primary" href="/recommendations" renderIcon={Recommend}>
          {cta}
        </Button>
      </div>
    </Tile>
  );
}
