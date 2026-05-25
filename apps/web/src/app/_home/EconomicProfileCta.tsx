import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

// V6.6 — prominent CTA when the org hasn't uploaded an IES yet.
// PRD §40 user story. Two ways forward: AI extraction or manual entry.
export function EconomicProfileCta() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Carregue o seu IES para desbloquear recomendações</CardTitle>
        <CardDescription>
          A IA extrai os dados económicos chave (volume de negócios, EBITDA, colaboradores, CAE) e
          o bGreen pode começar a sugerir medidas adequadas ao seu perfil.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link href="/economic-profile/ies/new" className={buttonVariants()}>
          Carregar IES
        </Link>
        <Link
          href="/economic-profile/manual"
          className={buttonVariants({ variant: "outline" })}
        >
          Entrada manual
        </Link>
      </CardContent>
    </Card>
  );
}
