import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comece por aqui</CardTitle>
        <CardDescription>
          Submeta um registo ESG ou carregue um IES para começar a ver indicadores e tendências.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link href="/records/new" className={buttonVariants({ size: "sm" })}>
          Novo registo
        </Link>
        <Link
          href="/economic-profile/ies/new"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Carregar IES
        </Link>
      </CardContent>
    </Card>
  );
}
