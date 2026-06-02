// Carbon-footprint report — landscape "deck" template. Assembles the
// deck pages (cover → executive summary → results → methodology) from
// the chart, KPI, and table primitives. Pure presentational: all data
// arrives validated in `data` (carbonFootprintDataSchema).

import { brandTheme } from "./shared/brand.js";
import { ContentPage, CoverPage, DeckDocument, SectionDivider } from "./shared/DeckLayout.js";
import { RichTable, type RichTableRow } from "./shared/RichTable.js";
import { AreaChart } from "./shared/charts/AreaChart.js";
import { DonutChart } from "./shared/charts/DonutChart.js";
import { KpiCard } from "./shared/charts/KpiCard.js";
import { Legend } from "./shared/charts/Legend.js";
import { StackedBarChart } from "./shared/charts/StackedBarChart.js";
import type { ChartSeriesDatum } from "./shared/charts/geometry.js";
import { formatNumber, formatTco2e } from "./shared/format.js";
import type { CarbonFootprintData } from "./types.js";

interface CarbonFootprintTemplateProps {
  data: CarbonFootprintData;
  brandingName: string;
  brandPrimaryColor: string | null;
  logoUrl: string | null;
}

export function CarbonFootprintTemplate({
  data,
  brandingName,
  brandPrimaryColor,
  logoUrl,
}: CarbonFootprintTemplateProps) {
  const theme = brandTheme(brandPrimaryColor);

  const scopeSlices: ChartSeriesDatum[] = data.scopes.map((s) => ({
    label: `Âmbito ${s.scope} · ${s.label}`,
    value: s.tco2e,
  }));

  // Detailed source donut: the dominant scope (largest total), broken
  // out by its sources — mirrors the reference "Âmbito 1 por fonte".
  // Sub-2% sources are folded into an "Outros" slice so invisible
  // slivers don't clutter the legend.
  const dominant = [...data.scopes].sort((a, b) => b.tco2e - a.tco2e)[0];
  const dominantSources = dominant
    ? groupSmallSlices(
        data.sources
          .filter((r) => r.scope === dominant.scope && r.tco2e > 0)
          .map((r) => ({ label: r.source, value: r.tco2e })),
        2,
      )
    : [];

  const page = {
    title: data.title,
    theme,
    logoUrl,
    organizationName: brandingName,
    footer: data.footer,
  } as const;

  return (
    <DeckDocument>
      <CoverPage
        title={data.title}
        subtitle={data.subtitle}
        organizationName={brandingName}
        period={data.period}
        logoUrl={logoUrl}
        theme={theme}
      />

      {/* 01 — Executive summary */}
      <SectionDivider index={1} title="Sumário Executivo" theme={theme} />
      <ContentPage {...page} title="Sumário Executivo">
        <div className="cf-summary">
          <div className="cf-summary-chart">
            <DonutChart
              data={scopeSlices}
              palette={theme.series}
              centerPrimary={formatNumber(data.totalTco2e, 0)}
              centerSecondary={data.unitLabel}
            />
            <Legend
              items={scopeSlices.map((s, i) => ({
                label: s.label,
                color: theme.series[i % theme.series.length] ?? "#999",
                value: formatTco2e(s.value),
              }))}
            />
          </div>
          <div className="cf-summary-side">
            <div className="kpi-row">
              <KpiCard
                label="Pegada total"
                value={formatNumber(data.totalTco2e, 0)}
                unit={data.unitLabel}
                accent={theme.primary}
                variant="hero"
              />
              {data.kpis.map((k, i) => (
                <KpiCard
                  key={i}
                  label={k.label}
                  value={formatNumber(k.value, k.decimals ?? 0)}
                  unit={k.unit}
                  accent={theme.primary}
                  delta={
                    k.deltaPct === null || k.deltaPct === undefined
                      ? undefined
                      : {
                          value: `${formatNumber(Math.abs(k.deltaPct), 1)}%`,
                          direction: k.deltaPct > 0 ? "up" : k.deltaPct < 0 ? "down" : "flat",
                        }
                  }
                />
              ))}
            </div>
            {data.intensity.length > 0 ? (
              <ul className="cf-intensity">
                {data.intensity.map((m, i) => (
                  <li key={i}>
                    <span className="cf-intensity-label">{m.label}</span>
                    <strong>
                      {formatNumber(m.value, m.decimals ?? 2)} {m.unit}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : null}
            {data.commentary && data.commentary.sections.length > 0 ? (
              <ul className="cf-highlights" style={{ borderLeftColor: theme.primary }}>
                {data.commentary.sections
                  .flatMap((s) => s.callouts)
                  .slice(0, 5)
                  .map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
              </ul>
            ) : null}
          </div>
        </div>
      </ContentPage>

      {/* 02 — Results */}
      <SectionDivider index={2} title="Resultados" theme={theme} />
      <ContentPage {...page} title="Resultados — Emissões por fonte">
        <RichTable
          theme={theme}
          headerGroups={[
            { label: "Fonte de emissão", span: 2 },
            { label: `Emissões (${data.unitLabel})`, span: 1 },
          ]}
          columns={[
            { key: "category", header: "Categoria", width: "32%" },
            { key: "source", header: "Fonte" },
            { key: "tco2e", header: data.unitLabel, align: "right", width: "18%" },
          ]}
          rows={buildResultsRows(data)}
          numberFormat={(n) => formatNumber(n, 1)}
        />
      </ContentPage>

      {/* Only render the distribution/trend page when there's something
          meaningful to show — a multi-slice source donut or a trend.
          Avoids a near-empty page (or a trivial 100% ring) when the
          source data is coarse (e.g. a single scope total). */}
      {dominantSources.length >= 2 || data.trend ? (
      <ContentPage {...page} title="Resultados — Distribuição e evolução">
        <div className="cf-charts-row">
          {dominant && dominantSources.length >= 2 ? (
            <div className="cf-chart-block">
              <h3 className="cf-chart-title">
                Âmbito {dominant.scope} por fonte
              </h3>
              <DonutChart
                data={dominantSources}
                palette={theme.series}
                centerPrimary={formatNumber(dominant.tco2e, 0)}
                centerSecondary={data.unitLabel}
              />
              <Legend
                columns={2}
                items={dominantSources.map((s, i) => ({
                  label: s.label,
                  color: theme.series[i % theme.series.length] ?? "#999",
                }))}
              />
            </div>
          ) : null}
          {data.trend ? (
            <div className="cf-chart-block cf-chart-block-wide">
              <h3 className="cf-chart-title">Evolução das emissões</h3>
              {renderTrend(data.trend, theme.series)}
              <Legend
                columns={Math.min(3, data.trend.series.length)}
                items={data.trend.series.map((s, i) => ({
                  label: s.label,
                  color: theme.series[i % theme.series.length] ?? "#999",
                }))}
              />
            </div>
          ) : null}
        </div>
      </ContentPage>
      ) : null}

      {/* 03 — Methodology */}
      {data.factors.length > 0 || data.methodologyNotes.length > 0 ? (
        <>
          <SectionDivider index={3} title="Metodologia" theme={theme} />
          <ContentPage {...page} title="Metodologia — Fatores de emissão">
            {data.factors.length > 0 ? (
              <RichTable
                theme={theme}
                columns={[
                  { key: "source", header: "Fonte de energia", width: "34%" },
                  { key: "factor", header: "Fator utilizado", align: "right", width: "18%" },
                  { key: "unit", header: "Unidade", width: "20%" },
                  { key: "reference", header: "Referência" },
                ]}
                rows={data.factors.map((f) => ({
                  cells: {
                    source: f.source,
                    factor: f.factor,
                    unit: f.unit,
                    reference: f.reference ?? "",
                  },
                }))}
              />
            ) : null}
            {data.methodologyNotes.length > 0 ? (
              <ul className="cf-notes">
                {data.methodologyNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : null}
          </ContentPage>
        </>
      ) : null}
    </DeckDocument>
  );
}

function renderTrend(trend: NonNullable<CarbonFootprintData["trend"]>, palette: string[]) {
  if (trend.style === "stacked-bar") {
    return (
      <StackedBarChart
        data={trend.periods.map((p, xi) => ({
          label: p,
          segments: trend.series.map((s) => ({ key: s.key, value: s.values[xi] ?? 0 })),
        }))}
        seriesKeys={trend.series.map((s) => s.key)}
        palette={palette}
        yUnit={trend.unit}
        formatValue={(n) => formatNumber(n, 0)}
      />
    );
  }
  return (
    <AreaChart
      xLabels={trend.periods}
      series={trend.series.map((s) => ({ key: s.key, label: s.label, values: s.values }))}
      stacked={trend.style === "stacked-area"}
      lineOnly={trend.style === "line"}
      palette={palette}
      yUnit={trend.unit}
      formatValue={(n) => formatNumber(n, 0)}
    />
  );
}

// Fold slices below `minPct` of the total into a single "Outros" slice
// (kept last). Avoids invisible slivers + redundant legend entries.
function groupSmallSlices(
  data: ChartSeriesDatum[],
  minPct: number,
  otherLabel = "Outros",
): ChartSeriesDatum[] {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total <= 0) return data;
  const threshold = (minPct / 100) * total;
  const big = data.filter((d) => d.value >= threshold);
  const small = data.filter((d) => d.value < threshold);
  if (small.length <= 1) return data;
  const otherValue = small.reduce((s, d) => s + d.value, 0);
  return [...big, { label: otherLabel, value: otherValue }];
}

// Group sources by scope (1→2→3), append a subtotal per scope and a
// grand-total row at the end.
function buildResultsRows(data: CarbonFootprintData): RichTableRow[] {
  const rows: RichTableRow[] = [];
  const scopesPresent = data.scopes.slice().sort((a, b) => a.scope.localeCompare(b.scope));
  for (const sc of scopesPresent) {
    const sources = data.sources.filter((r) => r.scope === sc.scope);
    for (const src of sources) {
      rows.push({ cells: { category: src.category, source: src.source, tco2e: src.tco2e } });
    }
    rows.push({
      cells: { category: `Âmbito ${sc.scope} · ${sc.label}`, source: "Subtotal", tco2e: sc.tco2e },
      emphasis: "subtotal",
    });
  }
  rows.push({
    cells: { category: "Total", source: "", tco2e: data.totalTco2e },
    emphasis: "total",
  });
  return rows;
}
