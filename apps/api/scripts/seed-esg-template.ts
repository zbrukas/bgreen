// Seed a deliberately feature-maximal ESG record template (+ two
// sub-templates) to hard-test the FormSchema engine end-to-end.
//
// Grounded in CSRD/ESRS data points (E1 climate, S1 own workforce, G1
// business conduct) but the field selection is chosen to exercise EVERY
// engine feature: every leaf kind, repeating with aggregate, calculated
// (incl. division-by-zero paths), showIf, multi_select bounds, per-field
// weight, option/number/threshold scoring, tier buckets, sourceMapping
// (self-prefill), and main+sub composition.
//
// Idempotent: fixed UUIDs + upsert on `id`. Re-running picks up edits to
// the schemas below. Each form schema is validated against
// `FormSchemaSchema` BEFORE insert — the repo writes JSONB raw (only the
// HTTP route validates), so the seed is the gatekeeper here.
//
// Run via: pnpm --filter @bgreen/api seed-esg-template

import "../src/setup.js";

import { db, pool, schema } from "@bgreen/db";
import { type FormSchema, FormSchemaSchema, type WorkflowDefinitionId } from "@bgreen/types";
import { eq, sql } from "drizzle-orm";

// Fixed UUIDs so the seed is idempotent and the main template can both
// compose the subs and self-reference for the sourceMapping demo without
// an insert-then-read round-trip.
const MAIN_ID = "0e597000-0000-4000-a000-000000000001";
const SOCIAL_ID = "0e597000-0000-4000-a000-000000000002";
const GOVERNANCE_ID = "0e597000-0000-4000-a000-000000000003";

// ---------------------------------------------------------------------------
// Main — Environmental (ESRS E1–E5)
// ---------------------------------------------------------------------------
const mainSchema: FormSchema = {
  version: 1,
  rows: [
    {
      id: "identificacao",
      label: "Identificação e período de relato",
      fields: [
        {
          id: "periodo_inicio",
          kind: "date",
          label: "Início do período",
          required: true,
          min: "2020-01-01",
          max: "2030-12-31",
        },
        {
          id: "periodo_fim",
          kind: "date",
          label: "Fim do período",
          required: true,
          min: "2020-01-01",
          max: "2030-12-31",
        },
        {
          id: "receita_meur",
          kind: "number",
          label: "Volume de negócios",
          unit: "M€",
          min: 0,
          required: true,
        },
        {
          id: "metodologia",
          kind: "text",
          label: "Metodologia de cálculo",
          description: "Pré-preenchida com o relato submetido no período anterior.",
          maxLength: 2000,
          // Self-prefill: seeds the field from the latest submitted record
          // of THIS template (same org).
          sourceMapping: {
            sourceTemplateId: MAIN_ID,
            sourceFieldId: "metodologia",
            strategy: "latest_submitted",
          },
        },
      ],
    },
    {
      id: "emissoes",
      label: "Emissões de GEE (ESRS E1-6)",
      fields: [
        {
          id: "scope1_tco2e",
          kind: "number",
          label: "Âmbito 1 (diretas)",
          unit: "tCO₂e",
          min: 0,
          required: true,
          weight: 2,
          scoring: {
            kind: "thresholds",
            thresholds: [
              { upTo: 1000, score: 10 },
              { upTo: 10000, score: 5 },
              { upTo: 50000, score: 2 },
            ],
          },
        },
        {
          id: "scope2_loc",
          kind: "number",
          label: "Âmbito 2 (location-based)",
          unit: "tCO₂e",
          min: 0,
        },
        {
          id: "scope2_mkt",
          kind: "number",
          label: "Âmbito 2 (market-based)",
          unit: "tCO₂e",
          min: 0,
          required: true,
          weight: 2,
          scoring: {
            kind: "thresholds",
            thresholds: [
              { upTo: 1000, score: 10 },
              { upTo: 10000, score: 5 },
              { upTo: 50000, score: 2 },
            ],
          },
        },
        {
          id: "scope3_reportado",
          kind: "select",
          label: "Âmbito 3 reportado?",
          required: true,
          options: [
            { value: "sim", label: "Sim", score: 10 },
            { value: "nao", label: "Não", score: 0 },
          ],
        },
        {
          id: "scope3_categorias",
          kind: "repeating",
          label: "Âmbito 3 por categoria (GHG Protocol)",
          rowLabel: "Categoria",
          minRows: 1,
          maxRows: 15,
          aggregate: "sum",
          // Only collected when Scope 3 is reported — a required repeating
          // field that must be skipped when hidden.
          showIf: [{ fieldId: "scope3_reportado", equals: "sim" }],
          fields: [
            {
              id: "categoria",
              kind: "select",
              label: "Categoria",
              required: true,
              options: [
                { value: "c1", label: "1 — Bens e serviços adquiridos", score: 1 },
                { value: "c4", label: "4 — Transporte a montante", score: 1 },
                { value: "c6", label: "6 — Viagens de negócios", score: 1 },
                { value: "c7", label: "7 — Deslocações casa-trabalho", score: 1 },
              ],
            },
            {
              id: "emissoes_tco2e",
              kind: "number",
              label: "Emissões",
              unit: "tCO₂e",
              min: 0,
              required: true,
              // Negative `per`: more emissions → lower score.
              scoring: { kind: "linear", per: -0.001 },
            },
            { id: "fonte_dados", kind: "text", label: "Fonte dos dados", maxLength: 200 },
            {
              id: "metodo",
              kind: "select",
              label: "Método",
              options: [
                { value: "medido", label: "Medido" },
                { value: "estimado", label: "Estimado" },
                { value: "calculado", label: "Calculado" },
              ],
            },
          ],
        },
        {
          id: "total_emissoes",
          kind: "calculated",
          label: "Total Âmbito 1+2",
          unit: "tCO₂e",
          expression: "scope1_tco2e + scope2_mkt",
        },
        {
          id: "intensidade",
          kind: "calculated",
          label: "Intensidade carbónica",
          unit: "tCO₂e/M€",
          // Cross-row ref + division-by-zero path when receita_meur = 0.
          expression: "(scope1_tco2e + scope2_mkt) / receita_meur",
        },
      ],
    },
    {
      id: "energia",
      label: "Energia (ESRS E1-5)",
      fields: [
        {
          id: "energia_total_mwh",
          kind: "number",
          label: "Consumo total de energia",
          unit: "MWh",
          min: 0,
          required: true,
        },
        {
          id: "energia_renovavel_mwh",
          kind: "number",
          label: "Energia renovável",
          unit: "MWh",
          min: 0,
        },
        {
          id: "quota_renovavel",
          kind: "calculated",
          label: "Quota de renováveis",
          unit: "%",
          expression: "energia_renovavel_mwh / energia_total_mwh * 100",
        },
        {
          id: "fontes_energia",
          kind: "multi_select",
          label: "Fontes de energia",
          minSelected: 1,
          maxSelected: 6,
          options: [
            { value: "rede", label: "Eletricidade da rede", score: 0 },
            { value: "solar", label: "Solar", score: 2 },
            { value: "eolica", label: "Eólica", score: 2 },
            { value: "biomassa", label: "Biomassa", score: 1 },
            { value: "gas", label: "Gás natural", score: 0 },
            { value: "gasoleo", label: "Gasóleo", score: 0 },
          ],
        },
      ],
    },
    {
      id: "agua_residuos",
      label: "Água e resíduos (ESRS E3/E5)",
      fields: [
        { id: "agua_captada_m3", kind: "number", label: "Água captada", unit: "m³", min: 0 },
        { id: "residuos_t", kind: "number", label: "Resíduos gerados", unit: "t", min: 0 },
        {
          id: "residuos_valorizados_pct",
          kind: "number",
          label: "Resíduos desviados de aterro",
          unit: "%",
          min: 0,
          max: 100,
          scoring: { kind: "linear", per: 0.1 },
        },
      ],
    },
    {
      id: "materialidade",
      label: "Avaliação de materialidade",
      fields: [
        {
          id: "topicos_materiais",
          kind: "multi_select",
          label: "Tópicos materiais",
          required: true,
          minSelected: 1,
          maxSelected: 7,
          options: [
            { value: "e1", label: "E1 Alterações climáticas", score: 1 },
            { value: "e2", label: "E2 Poluição", score: 1 },
            { value: "e3", label: "E3 Água e recursos marinhos", score: 1 },
            { value: "e4", label: "E4 Biodiversidade", score: 1 },
            { value: "e5", label: "E5 Economia circular", score: 1 },
            { value: "s1", label: "S1 Pessoal próprio", score: 1 },
            { value: "g1", label: "G1 Conduta empresarial", score: 1 },
          ],
        },
      ],
    },
  ],
  scoring: {
    maxScore: 60,
    buckets: [
      { minPct: 0, label: "D" },
      { minPct: 40, label: "C" },
      { minPct: 60, label: "B" },
      { minPct: 80, label: "A" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Sub-template — Social (ESRS S1)
// ---------------------------------------------------------------------------
const socialSchema: FormSchema = {
  version: 1,
  rows: [
    {
      id: "forca_trabalho",
      label: "Força de trabalho",
      fields: [
        {
          id: "colaboradores_total",
          kind: "number",
          label: "Total de colaboradores",
          min: 0,
          required: true,
        },
        {
          id: "mulheres_pct",
          kind: "number",
          label: "% de mulheres",
          unit: "%",
          min: 0,
          max: 100,
          weight: 2,
          scoring: {
            kind: "thresholds",
            thresholds: [
              { upTo: 30, score: 2 },
              { upTo: 45, score: 5 },
              { upTo: 60, score: 10 },
            ],
          },
        },
        {
          id: "lideranca_mulheres_pct",
          kind: "number",
          label: "% mulheres em liderança",
          unit: "%",
          min: 0,
          max: 100,
          scoring: { kind: "linear", per: 0.1 },
        },
        {
          id: "horas_formacao",
          kind: "number",
          label: "Horas de formação por colaborador",
          unit: "h",
          min: 0,
          scoring: { kind: "linear", per: 0.2 },
        },
        {
          id: "rotatividade_pct",
          kind: "number",
          label: "Taxa de rotatividade",
          unit: "%",
          min: 0,
          max: 100,
        },
      ],
    },
    {
      id: "seguranca",
      label: "Saúde e segurança",
      fields: [
        {
          id: "acidentes_por_tipo",
          kind: "repeating",
          label: "Acidentes por tipo",
          rowLabel: "Tipo",
          minRows: 0,
          maxRows: 10,
          aggregate: "sum",
          fields: [
            {
              id: "tipo",
              kind: "select",
              label: "Tipo de acidente",
              options: [
                { value: "ligeiro", label: "Ligeiro" },
                { value: "grave", label: "Grave" },
                { value: "fatal", label: "Fatal" },
              ],
            },
            { id: "numero", kind: "number", label: "Nº de ocorrências", min: 0 },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Sub-template — Governance (ESRS G1)
// ---------------------------------------------------------------------------
const governanceSchema: FormSchema = {
  version: 1,
  rows: [
    {
      id: "orgao",
      label: "Órgão de administração",
      fields: [
        {
          id: "dimensao_orgao",
          kind: "number",
          label: "Dimensão do órgão",
          min: 1,
          required: true,
        },
        {
          id: "independencia_pct",
          kind: "number",
          label: "% de membros independentes",
          unit: "%",
          min: 0,
          max: 100,
          weight: 2,
          scoring: {
            kind: "thresholds",
            thresholds: [
              { upTo: 33, score: 2 },
              { upTo: 50, score: 6 },
              { upTo: 100, score: 10 },
            ],
          },
        },
        {
          id: "mulheres_orgao_pct",
          kind: "number",
          label: "% mulheres no órgão",
          unit: "%",
          min: 0,
          max: 100,
        },
      ],
    },
    {
      id: "conduta",
      label: "Conduta empresarial",
      fields: [
        {
          id: "formacao_anticorrupcao_pct",
          kind: "number",
          label: "% formação anticorrupção",
          unit: "%",
          min: 0,
          max: 100,
          scoring: { kind: "linear", per: 0.1 },
        },
        { id: "violacoes_dados", kind: "number", label: "Violações de dados", min: 0 },
        {
          id: "transparencia_fiscal",
          kind: "select",
          label: "Relato fiscal por país?",
          options: [
            { value: "sim", label: "Sim", score: 5 },
            { value: "nao", label: "Não", score: 0 },
          ],
        },
        {
          id: "ultima_avaliacao_etica",
          kind: "date",
          label: "Última avaliação ética",
          max: "2030-12-31",
        },
      ],
    },
  ],
};

interface TemplateSeed {
  id: string;
  name: string;
  description: string;
  formSchema: FormSchema;
  workflowDefinitionId: WorkflowDefinitionId;
  isSubTemplate: boolean;
}

const TEMPLATES: TemplateSeed[] = [
  {
    id: SOCIAL_ID,
    name: "Indicadores Sociais (ESRS S1)",
    description: "Sub-modelo de pessoal próprio: força de trabalho e segurança.",
    formSchema: socialSchema,
    workflowDefinitionId: "single-step-submit",
    isSubTemplate: true,
  },
  {
    id: GOVERNANCE_ID,
    name: "Governação (ESRS G1)",
    description: "Sub-modelo de governação: órgão de administração e conduta.",
    formSchema: governanceSchema,
    workflowDefinitionId: "single-step-submit",
    isSubTemplate: true,
  },
  {
    id: MAIN_ID,
    name: "Relatório ESG Anual — Ambiente (ESRS E1)",
    description: "Modelo climático/ambiental ESRS E1–E5, composto com S1 e G1.",
    formSchema: mainSchema,
    workflowDefinitionId: "three-step-certify",
    isSubTemplate: false,
  },
];

// Sub-templates embedded in the main, in display order.
const COMPOSITION: string[] = [SOCIAL_ID, GOVERNANCE_ID];

async function resolveCreatorUserId(): Promise<string> {
  const adminEmail = process.env.GLOBAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    const [byEmail] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, adminEmail))
      .limit(1);
    if (byEmail) return byEmail.id;
  }
  const [anyAdmin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.userType, "central_services"))
    .limit(1);
  if (anyAdmin) return anyAdmin.id;
  throw new Error(
    "No central-services user found. Set GLOBAL_ADMIN_EMAIL and boot the API once, or seed an admin first.",
  );
}

async function main(): Promise<void> {
  // Validate every schema before touching the DB — the repository writes
  // form_schema as raw JSONB, so this is the only gate.
  for (const t of TEMPLATES) {
    FormSchemaSchema.parse(t.formSchema);
  }
  console.log(`Validated ${TEMPLATES.length} form schemas.`);

  const createdByUserId = await resolveCreatorUserId();

  for (const t of TEMPLATES) {
    await db
      .insert(schema.recordTemplates)
      .values({
        id: t.id,
        name: t.name,
        description: t.description,
        formSchema: t.formSchema,
        status: "published",
        workflowDefinitionId: t.workflowDefinitionId,
        isSubTemplate: t.isSubTemplate,
        createdByUserId,
      })
      .onConflictDoUpdate({
        target: schema.recordTemplates.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          formSchema: sql`excluded.form_schema`,
          status: sql`excluded.status`,
          workflowDefinitionId: sql`excluded.workflow_definition_id`,
          isSubTemplate: sql`excluded.is_sub_template`,
          updatedAt: sql`now()`,
        },
      });
    console.log(`  upserted ${t.isSubTemplate ? "sub" : "main"} template: ${t.name}`);
  }

  // Replace the main template's composition (mirrors CompositionRepository
  // .setForMain: delete + spaced positions, atomically).
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.templateCompositions)
      .where(eq(schema.templateCompositions.mainTemplateId, MAIN_ID));
    await tx.insert(schema.templateCompositions).values(
      COMPOSITION.map((subTemplateId, idx) => ({
        mainTemplateId: MAIN_ID,
        subTemplateId,
        position: (idx + 1) * 10,
      })),
    );
  });
  console.log(`  composed main with ${COMPOSITION.length} sub-templates.`);

  console.log("done — ESG hard-test template ensured");
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
