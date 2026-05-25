import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DIMENSAO_LABEL, type TrendYearRow } from "@/lib/economic-profile-types";
import Link from "next/link";

export function YearList({ rows }: { rows: TrendYearRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Por exercício</CardTitle>
        <CardDescription>
          Salte para o detalhe de qualquer ano para comparar diretamente com o setor.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <Link
            key={r.year}
            href={`/economic-profile/${r.year}/benchmark`}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
          >
            <span className="font-medium">{r.year}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.dimensao ? DIMENSAO_LABEL[r.dimensao] : "—"}
              {r.cae3 ? <span>· CAE {r.cae3}</span> : null}
              <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
