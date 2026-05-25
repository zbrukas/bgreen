import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/recommendations" className={buttonVariants({ size: "sm" })}>
          {cta}
        </Link>
      </CardContent>
    </Card>
  );
}
