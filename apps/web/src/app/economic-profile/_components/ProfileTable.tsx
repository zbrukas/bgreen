import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import Link from "next/link";
import { DimensaoCell } from "../DimensaoCell";
import { formatMoney } from "./format";

const SOURCE_LABEL: Record<OrganizationEconomicProfile["source"], string> = {
  ies_extracted: "IES",
  edited_after_extraction: "IES (editado)",
  manual: "Manual",
};

export function ProfileTable({ profiles }: { profiles: OrganizationEconomicProfile[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano</TableHead>
              <TableHead>Colaboradores</TableHead>
              <TableHead>Volume de negócios</TableHead>
              <TableHead>EBITDA</TableHead>
              <TableHead>Ativo total</TableHead>
              <TableHead>CAE</TableHead>
              <TableHead>Dimensão</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.year}</TableCell>
                <TableCell>{p.employees ?? "—"}</TableCell>
                <TableCell>{formatMoney(p.turnover)}</TableCell>
                <TableCell>{formatMoney(p.ebitda)}</TableCell>
                <TableCell>{formatMoney(p.balanceSheetTotal)}</TableCell>
                <TableCell>{p.cae ?? "—"}</TableCell>
                <TableCell>
                  <DimensaoCell profile={p} />
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{SOURCE_LABEL[p.source]}</span>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/economic-profile/${p.year}/benchmark`}
                    className="text-xs underline-offset-4 hover:underline"
                  >
                    Comparar com setor
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
