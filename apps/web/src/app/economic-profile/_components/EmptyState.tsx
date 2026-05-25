import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sem dados económicos ainda</CardTitle>
        <CardDescription>
          Carregue o seu IES para desbloquear recomendações e comparações setoriais.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
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
