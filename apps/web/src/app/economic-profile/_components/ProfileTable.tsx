import type { OrganizationEconomicProfile } from "@/lib/economic-profile-types";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@carbon/react";
import Link from "next/link";
import { DimensaoCell } from "../DimensaoCell";
import { formatMoney } from "./format";

type TagType = "blue" | "purple" | "cool-gray";
const SOURCE_LABEL: Record<OrganizationEconomicProfile["source"], string> = {
  ies_extracted: "IES",
  edited_after_extraction: "IES (editado)",
  manual: "Manual",
};
const SOURCE_TAG: Record<OrganizationEconomicProfile["source"], TagType> = {
  ies_extracted: "blue",
  edited_after_extraction: "purple",
  manual: "cool-gray",
};

export function ProfileTable({ profiles }: { profiles: OrganizationEconomicProfile[] }) {
  return (
    <TableContainer title={`Exercícios (${profiles.length})`}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Ano</TableHeader>
            <TableHeader>Colaboradores</TableHeader>
            <TableHeader>Volume de negócios</TableHeader>
            <TableHeader>EBITDA</TableHeader>
            <TableHeader>Ativo total</TableHeader>
            <TableHeader>CAE</TableHeader>
            <TableHeader>Dimensão</TableHeader>
            <TableHeader>Fonte</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
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
                <Tag type={SOURCE_TAG[p.source]} size="sm">
                  {SOURCE_LABEL[p.source]}
                </Tag>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/economic-profile/${p.year}/benchmark`}
                  className="text-xs text-[var(--cds-link-primary)] hover:underline"
                >
                  Comparar com setor
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
