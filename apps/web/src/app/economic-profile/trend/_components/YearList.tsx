import { DIMENSAO_LABEL, type TrendYearRow } from "@/lib/economic-profile-types";
import { Tile } from "@carbon/react";
import Link from "next/link";

export function YearList({ rows }: { rows: TrendYearRow[] }) {
  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        Por exercício
      </h2>
      <p className="mt-1 text-sm text-neutral-700">
        Salte para o detalhe de qualquer ano para comparar diretamente com o setor.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <Link
            key={r.year}
            href={`/economic-profile/${r.year}/benchmark`}
            className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <span className="font-medium">{r.year}</span>
            <span className="flex items-center gap-2 text-xs text-neutral-600">
              {r.dimensao ? DIMENSAO_LABEL[r.dimensao] : "—"}
              {r.cae3 ? <span>· CAE {r.cae3}</span> : null}
              <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </div>
    </Tile>
  );
}
