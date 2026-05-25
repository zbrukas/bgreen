"use client";

import {
  Add,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building,
  CheckmarkOutline,
  ChevronLeft,
  ChevronRight,
  Dashboard,
  Document,
  DocumentPdf,
  Download,
  Edit,
  Email,
  ErrorOutline,
  Filter,
  Help,
  Home,
  Information,
  Logout,
  Notification as NotificationIcon,
  OverflowMenuVertical,
  Search,
  Settings,
  TrashCan,
  Upload,
  UserMultiple,
  View,
  WarningAlt,
} from "@carbon/icons-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  ButtonSet,
  Checkbox,
  CheckboxGroup,
  ClickableTile,
  DangerButton,
  Dropdown,
  FileUploader,
  FormGroup,
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  IconButton,
  InlineLoading,
  InlineNotification,
  NumberInput,
  OverflowMenu,
  OverflowMenuItem,
  ProgressBar,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  TextArea,
  TextInput,
  Theme,
  Tile,
  Toggletip,
  ToggletipActions,
  ToggletipButton,
  ToggletipContent,
} from "@carbon/react";
import type { ReactNode } from "react";

const SECTIONS = [
  { id: "typography", label: "Typography" },
  { id: "colour", label: "Colour tokens" },
  { id: "icons", label: "Icons" },
  { id: "buttons", label: "Buttons" },
  { id: "tags", label: "Tags" },
  { id: "page-header", label: "PageHeader" },
  { id: "stat-card", label: "StatCard" },
  { id: "empty-state", label: "EmptyState" },
  { id: "data-table", label: "DataTable" },
  { id: "structured-list", label: "StructuredList" },
  { id: "notification", label: "Notification" },
  { id: "form", label: "Form patterns" },
  { id: "shell", label: "UI Shell preview" },
  { id: "motion", label: "Motion" },
] as const;

export function DesignShowcase() {
  return (
    <Theme theme="white" data-carbon-theme="white">
      <div className="min-h-screen bg-white text-neutral-900">
        <div className="mx-auto grid max-w-[1400px] grid-cols-[220px_minmax(0,1fr)] gap-12 px-8 py-12">
          <TOC />
          <main className="min-w-0">
            <Header___ />
            <Stack gap={10}>
              <TypographySection />
              <ColourSection />
              <IconsSection />
              <ButtonsSection />
              <TagsSection />
              <PageHeaderSection />
              <StatCardSection />
              <EmptyStateSection />
              <DataTableSection />
              <StructuredListSection />
              <NotificationSection />
              <FormSection />
              <ShellSection />
              <MotionSection />
            </Stack>
          </main>
        </div>
      </div>
    </Theme>
  );
}

function TOC() {
  return (
    <aside className="sticky top-12 self-start">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Secções
      </p>
      <nav className="flex flex-col gap-1">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {s.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

function Header___() {
  return (
    <header className="mb-12">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
        bGreen · Design system · Fase 0
      </p>
      <h1
        className="cds--type-productive-heading-06"
        style={{ fontSize: "2.25rem", fontWeight: 300, letterSpacing: "0.16px" }}
      >
        Carbon themed for bGreen
      </h1>
      <p
        className="mt-2 max-w-2xl text-neutral-700"
        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
      >
        Showcase de cada primitiva visual antes do rollout para as páginas reais. Aprovação aqui
        desbloqueia a Fase 1 (shell partilhada). Veja{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
          plans/ui-carbon-migration/README.md
        </code>
        .
      </p>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Typography
// ─────────────────────────────────────────────────────────────────────────────

function TypographySection() {
  return (
    <Section id="typography" title="Typography" caption="IBM Plex Sans · Productive scale">
      <Tile>
        <div className="space-y-4">
          <TypeRow token="productive-heading-07" label="Heading 07 · 54 / 64">
            <span style={{ fontSize: "3.375rem", fontWeight: 300, lineHeight: 1.19 }}>
              Recolha de dados ESG
            </span>
          </TypeRow>
          <TypeRow token="productive-heading-05" label="Heading 05 · 32 / 40">
            <span style={{ fontSize: "2rem", fontWeight: 400, lineHeight: 1.25 }}>
              Painel da organização
            </span>
          </TypeRow>
          <TypeRow token="productive-heading-04" label="Heading 04 · 28 / 36">
            <span style={{ fontSize: "1.75rem", fontWeight: 400, lineHeight: 1.28 }}>
              Modelo ESG 2026
            </span>
          </TypeRow>
          <TypeRow token="productive-heading-03" label="Heading 03 · 20 / 28">
            <span style={{ fontSize: "1.25rem", fontWeight: 400, lineHeight: 1.4 }}>
              Resumo de submissões pendentes
            </span>
          </TypeRow>
          <TypeRow token="productive-heading-02" label="Heading 02 · 16 / 22">
            <span style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375 }}>
              Indicadores chave
            </span>
          </TypeRow>
          <TypeRow token="body-long-01" label="Body 01 · 14 / 20">
            <span style={{ fontSize: "0.875rem", lineHeight: 1.43 }}>
              A IA extrai dados económicos chave do IES e sugere medidas adequadas ao perfil da sua
              organização.
            </span>
          </TypeRow>
          <TypeRow token="helper-text-01" label="Helper text · 12 / 16">
            <span style={{ fontSize: "0.75rem", lineHeight: 1.33, color: "var(--cds-text-helper)" }}>
              Apenas ficheiros PDF. Máximo 10 MB.
            </span>
          </TypeRow>
          <TypeRow token="code-01" label="Code 01 · Plex Mono">
            <code
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "0.75rem",
                lineHeight: 1.33,
              }}
            >
              PT507123456 · 2026-05-25T10:42:00Z
            </code>
          </TypeRow>
        </div>
      </Tile>
    </Section>
  );
}

function TypeRow({
  token,
  label,
  children,
}: {
  token: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-baseline gap-6 border-b border-neutral-200 pb-3 last:border-b-0 last:pb-0">
      <div>
        <p className="text-xs font-semibold text-neutral-900">{label}</p>
        <code className="text-[10px] text-neutral-500" style={{ fontFamily: "'IBM Plex Mono'" }}>
          {token}
        </code>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Colour tokens
// ─────────────────────────────────────────────────────────────────────────────

function ColourSection() {
  return (
    <Section id="colour" title="Colour tokens" caption="Paleta bGreen nomeada · Carbon neutrals para o resto">
      <Stack gap={6}>
        <ColourBlock
          title="Brand"
          swatches={[
            { name: "mint leaf", hex: "#63B995", token: "button-primary · link · focus · brand" },
            { name: "shadow grey", hex: "#37323E", token: "text-primary · icon-primary" },
          ]}
        />
        <ColourBlock
          title="Semantic"
          swatches={[
            { name: "cinnabar", hex: "#FF312E", token: "support-error · button-danger" },
            { name: "jasmine", hex: "#FFD97D", token: "support-warning" },
            { name: "fern", hex: "#50723C", token: "support-success" },
          ]}
        />
        <ColourBlock
          title="Neutrals — Carbon gray scale"
          swatches={[
            { name: "shadow grey", hex: "#37323E", token: "text-primary (override)" },
            { name: "gray-80", hex: "#393939", token: "text-secondary" },
            { name: "gray-60", hex: "#6f6f6f", token: "text-helper" },
            { name: "gray-30", hex: "#c6c6c6", token: "border-subtle" },
            { name: "gray-10", hex: "#f4f4f4", token: "layer-01" },
            { name: "white", hex: "#ffffff", token: "background" },
          ]}
        />
      </Stack>
    </Section>
  );
}

function ColourBlock({
  title,
  swatches,
}: {
  title: string;
  swatches: Array<{ name: string; hex: string; token: string }>;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-neutral-900">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {swatches.map((s) => (
          <div key={s.name} className="overflow-hidden border border-neutral-200">
            <div className="h-16" style={{ backgroundColor: s.hex }} />
            <div className="p-2">
              <p className="text-xs font-semibold text-neutral-900">{s.name}</p>
              <p
                className="text-[10px] text-neutral-500"
                style={{ fontFamily: "'IBM Plex Mono'" }}
              >
                {s.hex}
              </p>
              <p className="text-[10px] text-neutral-500">{s.token}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Icons
// ─────────────────────────────────────────────────────────────────────────────

const ICONS = [
  { Icon: Home, name: "Home" },
  { Icon: Dashboard, name: "Dashboard" },
  { Icon: Document, name: "Document" },
  { Icon: DocumentPdf, name: "DocumentPdf" },
  { Icon: NotificationIcon, name: "Notification" },
  { Icon: Email, name: "Email" },
  { Icon: UserMultiple, name: "UserMultiple" },
  { Icon: Building, name: "Building" },
  { Icon: Settings, name: "Settings" },
  { Icon: Search, name: "Search" },
  { Icon: Filter, name: "Filter" },
  { Icon: Add, name: "Add" },
  { Icon: Edit, name: "Edit" },
  { Icon: TrashCan, name: "TrashCan" },
  { Icon: Download, name: "Download" },
  { Icon: Upload, name: "Upload" },
  { Icon: View, name: "View" },
  { Icon: OverflowMenuVertical, name: "OverflowMenuVertical" },
  { Icon: ChevronRight, name: "ChevronRight" },
  { Icon: ChevronLeft, name: "ChevronLeft" },
  { Icon: ArrowUp, name: "ArrowUp" },
  { Icon: ArrowDown, name: "ArrowDown" },
  { Icon: CheckmarkOutline, name: "CheckmarkOutline" },
  { Icon: WarningAlt, name: "WarningAlt" },
  { Icon: ErrorOutline, name: "ErrorOutline" },
  { Icon: Information, name: "Information" },
  { Icon: Help, name: "Help" },
  { Icon: Logout, name: "Logout" },
] as const;

function IconsSection() {
  return (
    <Section id="icons" title="Icons" caption="@carbon/icons-react · standard subset · 16/20/24 px">
      <Tile>
        <div className="mb-4 flex items-end gap-6">
          <SizedIcon size={16} />
          <SizedIcon size={20} />
          <SizedIcon size={24} />
        </div>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-7">
          {ICONS.map(({ Icon, name }) => (
            <div
              key={name}
              className="flex flex-col items-center gap-1 border border-neutral-200 p-3"
            >
              <Icon size={20} />
              <code
                className="text-[10px] text-neutral-600"
                style={{ fontFamily: "'IBM Plex Mono'" }}
              >
                {name}
              </code>
            </div>
          ))}
        </div>
      </Tile>
    </Section>
  );
}

function SizedIcon({ size }: { size: 16 | 20 | 24 }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Dashboard size={size} />
      <span className="text-[10px] text-neutral-500">{size}px</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Buttons
// ─────────────────────────────────────────────────────────────────────────────

function ButtonsSection() {
  return (
    <Section id="buttons" title="Buttons" caption="Carbon Button · kind × size × icon">
      <Tile>
        <Stack gap={6}>
          <SubGrid label="Kind (size: md)">
            <Button kind="primary">Submeter registo</Button>
            <Button kind="secondary">Guardar rascunho</Button>
            <Button kind="tertiary">Cancelar</Button>
            <Button kind="ghost">Voltar</Button>
            <DangerButton>Eliminar</DangerButton>
          </SubGrid>
          <SubGrid label="With leading icon">
            <Button kind="primary" renderIcon={Add}>
              Novo registo
            </Button>
            <Button kind="secondary" renderIcon={Download}>
              Exportar
            </Button>
            <Button kind="tertiary" renderIcon={Filter}>
              Filtrar
            </Button>
            <Button kind="ghost" renderIcon={ArrowRight}>
              Continuar
            </Button>
          </SubGrid>
          <SubGrid label="Size">
            <Button kind="primary" size="sm">
              sm
            </Button>
            <Button kind="primary" size="md">
              md (default)
            </Button>
            <Button kind="primary" size="lg">
              lg
            </Button>
            <Button kind="primary" size="xl">
              xl (hero)
            </Button>
          </SubGrid>
          <SubGrid label="Icon-only · loading · disabled">
            <IconButton label="Editar" kind="ghost">
              <Edit />
            </IconButton>
            <IconButton label="Eliminar" kind="ghost">
              <TrashCan />
            </IconButton>
            <IconButton label="Mais opções" kind="ghost">
              <OverflowMenuVertical />
            </IconButton>
            <Button kind="primary" disabled>
              Desactivado
            </Button>
            <InlineLoading description="A submeter…" status="active" />
          </SubGrid>
          <SubGrid label="ButtonSet — paired actions">
            <ButtonSet>
              <Button kind="secondary">Cancelar</Button>
              <Button kind="primary">Confirmar</Button>
            </ButtonSet>
          </SubGrid>
        </Stack>
      </Tile>
    </Section>
  );
}

function SubGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Tags
// ─────────────────────────────────────────────────────────────────────────────

function TagsSection() {
  return (
    <Section
      id="tags"
      title="Tags"
      caption="Mapping for record status (V4) and score tier (V8)"
    >
      <Tile>
        <Stack gap={6}>
          <SubGrid label="Record status">
            <Tag type="cool-gray">Rascunho</Tag>
            <Tag type="blue">Submetido</Tag>
            <Tag type="green">Aprovado</Tag>
            <Tag type="warm-gray">Arquivado</Tag>
            <Tag type="magenta">Alterações pedidas</Tag>
            <Tag type="red">Rejeitado</Tag>
          </SubGrid>
          <SubGrid label="Score tier">
            <Tag type="green" size="md">
              Tier A
            </Tag>
            <Tag type="blue" size="md">
              Tier B
            </Tag>
            <Tag type="purple" size="md">
              Tier C
            </Tag>
            <Tag type="warm-gray" size="md">
              N/A
            </Tag>
          </SubGrid>
          <SubGrid label="With icon">
            <Tag type="green" renderIcon={CheckmarkOutline}>
              Aprovado
            </Tag>
            <Tag type="red" renderIcon={ErrorOutline}>
              Erro de validação
            </Tag>
            <Tag type="purple" renderIcon={Information}>
              Em revisão
            </Tag>
          </SubGrid>
        </Stack>
      </Tile>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PageHeader (custom shared component proposal)
// ─────────────────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: typeof Dashboard;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}

function PageHeader({ title, description, icon: Icon, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="border-b border-neutral-200 pb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-2">
          {breadcrumbs.map((b, i) => (
            <BreadcrumbItem key={i} href={b.href} isCurrentPage={i === breadcrumbs.length - 1}>
              {b.label}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      )}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="mt-1 text-[var(--cds-icon-primary)]">
              <Icon size={24} />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 400, lineHeight: 1.28, margin: 0 }}>
              {title}
            </h1>
            {description && (
              <p
                className="mt-1 max-w-2xl text-neutral-700"
                style={{ fontSize: "0.875rem", lineHeight: 1.43 }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function PageHeaderSection() {
  return (
    <Section
      id="page-header"
      title="PageHeader"
      caption="Shared component proposal · replaces inline title+description+actions on every page"
    >
      <Stack gap={4}>
        <Tile>
          <PageHeader title="Painel" description="Resumo dos seus indicadores ESG e desempenho frente a pares do setor." />
        </Tile>
        <Tile>
          <PageHeader
            title="Modelo ESG 2026"
            description="Submeta este modelo para actualizar o seu score do trimestre."
            icon={Document}
            breadcrumbs={[
              { label: "Modelos", href: "/templates" },
              { label: "ESG 2026" },
            ]}
            actions={
              <>
                <Button kind="ghost" renderIcon={Download}>
                  Exportar
                </Button>
                <Button kind="primary" renderIcon={Add}>
                  Novo registo
                </Button>
              </>
            }
          />
        </Tile>
        <Tile>
          <PageHeader
            title="Registos pendentes de revisão"
            icon={NotificationIcon}
            actions={
              <Button kind="tertiary" renderIcon={Filter}>
                Filtrar
              </Button>
            }
          />
        </Tile>
      </Stack>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. StatCard (custom shared component proposal)
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  tier?: { label: string; type: "green" | "blue" | "purple" | "warm-gray" };
  sparkline?: number[];
  icon?: typeof Dashboard;
}

function StatCard({ label, value, unit, delta, tier, sparkline, icon: Icon }: StatCardProps) {
  return (
    <Tile>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-neutral-600">
          {Icon && <Icon size={16} />}
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        {tier && <Tag type={tier.type}>{tier.label}</Tag>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span style={{ fontSize: "2rem", fontWeight: 400, lineHeight: 1, letterSpacing: "-0.5px" }}>
          {value}
        </span>
        {unit && <span className="text-sm text-neutral-600">{unit}</span>}
      </div>
      {delta && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {delta.direction === "up" && (
            <ArrowUp size={12} style={{ color: "var(--cds-support-success)" }} />
          )}
          {delta.direction === "down" && (
            <ArrowDown size={12} style={{ color: "var(--cds-support-error)" }} />
          )}
          {delta.direction === "flat" && <span className="text-neutral-500">→</span>}
          <span
            className={
              delta.direction === "up"
                ? "text-[var(--cds-support-success)]"
                : delta.direction === "down"
                  ? "text-[var(--cds-support-error)]"
                  : "text-neutral-600"
            }
          >
            {delta.value}
          </span>
          <span className="text-neutral-500">vs. trimestre anterior</span>
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4">
          <MiniSparkline values={sparkline} />
        </div>
      )}
    </Tile>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const w = 200;
  const h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1 || 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Sparkline">
      <polyline
        points={points}
        fill="none"
        stroke="var(--cds-interactive, #1f7a3d)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function StatCardSection() {
  return (
    <Section
      id="stat-card"
      title="StatCard"
      caption="Shared component proposal · replaces dashboard ScoreCard + EconomicProfileSummary"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Score ESG 2026"
          value="72"
          unit="/ 100"
          delta={{ value: "+4", direction: "up" }}
          tier={{ label: "Tier B", type: "blue" }}
          sparkline={[58, 62, 60, 65, 68, 72]}
          icon={Document}
        />
        <StatCard
          label="Volume de negócios"
          value="2,4M"
          unit="EUR"
          delta={{ value: "+12%", direction: "up" }}
          sparkline={[1.8, 1.9, 2.0, 2.1, 2.2, 2.4]}
          icon={Building}
        />
        <StatCard
          label="Pendentes de revisão"
          value="3"
          delta={{ value: "-1", direction: "down" }}
          icon={NotificationIcon}
        />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. EmptyState (custom shared component proposal)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyStateIllustration() {
  return (
    <svg width={120} height={96} viewBox="0 0 120 96" role="img" aria-label="">
      <rect x="20" y="16" width="80" height="64" fill="#f4f4f4" stroke="#c6c6c6" />
      <rect x="28" y="24" width="40" height="6" fill="#c6c6c6" />
      <rect x="28" y="36" width="64" height="4" fill="#e0e0e0" />
      <rect x="28" y="44" width="50" height="4" fill="#e0e0e0" />
      <rect x="28" y="52" width="60" height="4" fill="#e0e0e0" />
      <circle cx="60" cy="68" r="6" fill="#1f7a3d" opacity="0.2" />
      <circle cx="60" cy="68" r="3" fill="#1f7a3d" />
    </svg>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  primaryAction?: { label: string; icon?: typeof Add };
  secondaryAction?: { label: string; icon?: typeof Add };
}

function EmptyState({ title, description, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <Tile>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <EmptyStateIllustration />
        <div className="max-w-md">
          <h3 style={{ fontSize: "1.25rem", fontWeight: 400, margin: 0 }}>{title}</h3>
          <p className="mt-1 text-sm text-neutral-700">{description}</p>
        </div>
        {(primaryAction || secondaryAction) && (
          <ButtonSet>
            {secondaryAction && (
              <Button kind="secondary" renderIcon={secondaryAction.icon}>
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button kind="primary" renderIcon={primaryAction.icon}>
                {primaryAction.label}
              </Button>
            )}
          </ButtonSet>
        )}
      </div>
    </Tile>
  );
}

function EmptyStateSection() {
  return (
    <Section
      id="empty-state"
      title="EmptyState"
      caption="Shared component proposal · used by dashboard / records / inbox / profile"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <EmptyState
          title="Sem registos ainda"
          description="Submeta o primeiro registo para começar a ver indicadores e tendências no painel."
          primaryAction={{ label: "Novo registo", icon: Add }}
          secondaryAction={{ label: "Carregar IES", icon: Upload }}
        />
        <EmptyState
          title="Nada por rever"
          description="Não tem submissões à espera. Quando os membros submeterem novos registos, aparecerão aqui."
        />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. DataTable
// ─────────────────────────────────────────────────────────────────────────────

const RECORDS = [
  {
    id: "r1",
    template: "ESG 2026 — anual",
    status: "submitted",
    statusLabel: "Submetido",
    submittedAt: "2026-05-20 10:42",
    score: 72,
  },
  {
    id: "r2",
    template: "Auditoria energética",
    status: "draft",
    statusLabel: "Rascunho",
    submittedAt: "—",
    score: null,
  },
  {
    id: "r3",
    template: "ESG 2026 — anual",
    status: "approved",
    statusLabel: "Aprovado",
    submittedAt: "2026-04-12 16:01",
    score: 68,
  },
  {
    id: "r4",
    template: "Inquérito GHG",
    status: "changes_requested",
    statusLabel: "Alterações pedidas",
    submittedAt: "2026-05-22 09:18",
    score: 55,
  },
];

type TagType = "cool-gray" | "blue" | "green" | "magenta" | "red";
const STATUS_TAG: Record<string, TagType> = {
  draft: "cool-gray",
  submitted: "blue",
  approved: "green",
  changes_requested: "magenta",
  rejected: "red",
};

function statusTag(s: string, label: string) {
  return <Tag type={STATUS_TAG[s] ?? "cool-gray"}>{label}</Tag>;
}

function DataTableSection() {
  return (
    <Section
      id="data-table"
      title="DataTable"
      caption="Carbon Table + Toolbar · search · status-tag column · overflow menu"
    >
      <TableContainer title="Registos" description="Histórico de submissões e seus estados.">
        <TableToolbar>
          <TableToolbarContent>
            <TableToolbarSearch onChange={() => undefined} />
            <Button kind="ghost" renderIcon={Filter}>
              Filtrar
            </Button>
            <Button kind="primary" renderIcon={Add}>
              Novo registo
            </Button>
          </TableToolbarContent>
        </TableToolbar>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Modelo</TableHeader>
              <TableHeader>Estado</TableHeader>
              <TableHeader>Submetido</TableHeader>
              <TableHeader>Score</TableHeader>
              <TableHeader />
            </TableRow>
          </TableHead>
          <TableBody>
            {RECORDS.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.template}</TableCell>
                <TableCell>{statusTag(r.status, r.statusLabel)}</TableCell>
                <TableCell>{r.submittedAt}</TableCell>
                <TableCell>{r.score !== null ? `${r.score} / 100` : "—"}</TableCell>
                <TableCell>
                  <OverflowMenu flipped aria-label="Acções">
                    <OverflowMenuItem itemText="Abrir" />
                    <OverflowMenuItem itemText="Duplicar" />
                    <OverflowMenuItem itemText="Eliminar" isDelete hasDivider />
                  </OverflowMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. StructuredList
// ─────────────────────────────────────────────────────────────────────────────

function StructuredListSection() {
  return (
    <Section
      id="structured-list"
      title="StructuredList"
      caption="Definition-list pattern · use for read-only record values, system info, account details"
    >
      <StructuredListWrapper>
        <StructuredListHead>
          <StructuredListRow head>
            <StructuredListCell head>Campo</StructuredListCell>
            <StructuredListCell head>Valor</StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>
        <StructuredListBody>
          <StructuredListRow>
            <StructuredListCell>NIF</StructuredListCell>
            <StructuredListCell>
              <code style={{ fontFamily: "'IBM Plex Mono'" }}>507123456</code>
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Designação</StructuredListCell>
            <StructuredListCell>Organização Exemplo, Lda</StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>CAE principal</StructuredListCell>
            <StructuredListCell>
              <Tag type="cool-gray">62010 — Programação informática</Tag>
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Sede</StructuredListCell>
            <StructuredListCell>Lisboa, Portugal (1000-001)</StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Colaboradores (2024)</StructuredListCell>
            <StructuredListCell>42</StructuredListCell>
          </StructuredListRow>
        </StructuredListBody>
      </StructuredListWrapper>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Notification
// ─────────────────────────────────────────────────────────────────────────────

function NotificationSection() {
  return (
    <Section
      id="notification"
      title="Notification"
      caption="Inline notifications · 4 semantic states · also use for review feedback panels"
    >
      <Stack gap={4}>
        <InlineNotification
          kind="info"
          title="A processar IES"
          subtitle="A extracção demora cerca de 30 segundos. Pode continuar a navegar."
          lowContrast
        />
        <InlineNotification
          kind="success"
          title="Registo aprovado"
          subtitle="O score foi actualizado no painel."
          lowContrast
        />
        <InlineNotification
          kind="warning"
          title="Validação parcial"
          subtitle="2 campos opcionais ficaram por preencher — pode submeter na mesma."
          lowContrast
        />
        <InlineNotification
          kind="error"
          title="Falha ao consultar VIES"
          subtitle="Não foi possível validar o NIF. Tente novamente em alguns instantes."
          lowContrast
        />
      </Stack>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Form patterns
// ─────────────────────────────────────────────────────────────────────────────

function FormSection() {
  return (
    <Section
      id="form"
      title="Form patterns"
      caption="TextInput · Select · NumberInput · RadioButtonGroup · TextArea · FileUploader · validation states"
    >
      <Tile>
        <Stack gap={6}>
          <FormGroup legendText="Identificação">
            <Stack gap={5}>
              <TextInput
                id="nif"
                labelText="NIF"
                helperText="Validamos automaticamente contra o VIES."
                placeholder="9 dígitos"
              />
              <TextInput
                id="nif-valid"
                labelText="NIF (válido)"
                value="507123456"
                helperText="✓ NIF válido — preenchimento automático em curso"
                readOnly
              />
              <TextInput
                id="nif-invalid"
                labelText="NIF (inválido)"
                value="123"
                invalid
                invalidText="NIF inválido — deve ter 9 dígitos."
              />
              <TextInput
                id="nif-warn"
                labelText="NIF (aviso)"
                value="507123456"
                warn
                warnText="VIES não respondeu — vamos validar mais tarde."
              />
            </Stack>
          </FormGroup>

          <FormGroup legendText="Dados económicos">
            <Stack gap={5}>
              <NumberInput
                id="turnover"
                label="Volume de negócios"
                helperText="EUR — exercício anterior"
                value={2400000}
                step={1000}
                min={0}
              />
              <Select id="cae-tier" labelText="Dimensão" defaultValue="medium">
                <SelectItem value="micro" text="Micro (< 10 colaboradores)" />
                <SelectItem value="small" text="Pequena (10–49)" />
                <SelectItem value="medium" text="Média (50–249)" />
                <SelectItem value="large" text="Grande (≥ 250)" />
              </Select>
              <Dropdown
                id="reporting-year"
                titleText="Ano de reporte"
                label="Selecione"
                items={["2024", "2025", "2026"]}
                initialSelectedItem="2026"
              />
            </Stack>
          </FormGroup>

          <FormGroup legendText="Decisão de revisão">
            <RadioButtonGroup name="decision" orientation="vertical" legendText="">
              <RadioButton labelText="Aprovar" value="approve" id="dec-approve" />
              <RadioButton labelText="Pedir alterações" value="changes" id="dec-changes" />
              <RadioButton labelText="Rejeitar" value="reject" id="dec-reject" />
            </RadioButtonGroup>
          </FormGroup>

          <CheckboxGroup legendText="Estruturas adicionais">
            <Checkbox labelText="Auditoria energética anual" id="cb-1" />
            <Checkbox labelText="Plano de descarbonização" id="cb-2" defaultChecked />
            <Checkbox labelText="Reporting ESRS" id="cb-3" />
          </CheckboxGroup>

          <TextArea
            id="comment"
            labelText="Comentário do revisor"
            placeholder="Indique alterações necessárias ou observações…"
            rows={4}
          />

          <FileUploader
            labelTitle="Carregar IES"
            labelDescription="Apenas PDF. Máximo 10 MB."
            buttonLabel="Escolher ficheiro"
            buttonKind="primary"
            filenameStatus="edit"
            accept={[".pdf"]}
            iconDescription="Limpar ficheiro"
          />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Progresso de upload
            </p>
            <ProgressBar
              label="A carregar IES2024.pdf"
              helperText="2,4 MB de 4,8 MB"
              value={50}
              max={100}
            />
          </div>
        </Stack>
      </Tile>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. UI Shell preview
// ─────────────────────────────────────────────────────────────────────────────

function ShellSection() {
  return (
    <Section
      id="shell"
      title="UI Shell preview"
      caption="Carbon Header + SideNav · not yet wired to real routes · Phase 1 deliverable"
    >
      <div className="overflow-hidden border border-neutral-200">
        <div className="relative" style={{ height: 480 }}>
          <Header aria-label="bGreen">
            <HeaderName href="#" prefix="bGreen">
              ESG
            </HeaderName>
            <HeaderNavigation aria-label="bGreen navigation">
              <HeaderMenuItem href="#">Painel</HeaderMenuItem>
              <HeaderMenuItem href="#">Pendentes</HeaderMenuItem>
              <HeaderMenuItem href="#">Registos</HeaderMenuItem>
              <HeaderMenuItem href="#">Perfil económico</HeaderMenuItem>
            </HeaderNavigation>
            <HeaderGlobalBar>
              <HeaderGlobalAction aria-label="Pesquisar">
                <Search size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="Notificações">
                <NotificationIcon size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="Sair">
                <Logout size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
          </Header>
          <SideNav aria-label="Side navigation" expanded isFixedNav={false}>
            <SideNavItems>
              <SideNavLink renderIcon={Dashboard} href="#" isActive>
                Painel
              </SideNavLink>
              <SideNavLink renderIcon={NotificationIcon} href="#">
                Pendentes
              </SideNavLink>
              <SideNavLink renderIcon={Document} href="#">
                Registos
              </SideNavLink>
              <SideNavLink renderIcon={Building} href="#">
                Perfil económico
              </SideNavLink>
              <SideNavDivider />
              <SideNavLink renderIcon={UserMultiple} href="#">
                Membros
              </SideNavLink>
              <SideNavLink renderIcon={Settings} href="#">
                Definições
              </SideNavLink>
            </SideNavItems>
          </SideNav>
          <div
            className="absolute right-0 top-12 bottom-0 bg-neutral-50 p-6"
            style={{ left: 256 }}
          >
            <PageHeader
              title="Painel"
              description="Resumo dos seus indicadores ESG."
              actions={
                <Button kind="primary" renderIcon={Add}>
                  Novo registo
                </Button>
              }
            />
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Preview encapsulada — Header e SideNav são `position: fixed` em produção. A versão real será
        integrada no <code>layout.tsx</code> na Fase 1.
      </p>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Motion
// ─────────────────────────────────────────────────────────────────────────────

function MotionSection() {
  return (
    <Section
      id="motion"
      title="Motion"
      caption="Carbon productive motion tokens · CSS transitions only"
    >
      <Tile>
        <Stack gap={4}>
          <SubGrid label="Button hover (default Carbon transitions)">
            <Button kind="primary">Hover-me</Button>
            <Button kind="secondary">Hover-me</Button>
            <Button kind="ghost">Hover-me</Button>
          </SubGrid>
          <SubGrid label="ClickableTile (entrance + press)">
            <div className="flex gap-3" style={{ width: 480 }}>
              <ClickableTile href="#">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Novo registo
                </p>
                <p className="mt-1 text-sm">Comece um modelo a partir do zero.</p>
              </ClickableTile>
              <ClickableTile href="#">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Carregar IES
                </p>
                <p className="mt-1 text-sm">Extracção automática com IA.</p>
              </ClickableTile>
            </div>
          </SubGrid>
          <SubGrid label="Toggletip (hover/focus expansion)">
            <Toggletip>
              <ToggletipButton label="Mais informação">
                <Help />
              </ToggletipButton>
              <ToggletipContent>
                <p>
                  O score é calculado no momento da submissão e armazenado com o registo. Não é
                  recalculado mais tarde.
                </p>
                <ToggletipActions>
                  <Button size="sm" kind="ghost">
                    Saiba mais
                  </Button>
                </ToggletipActions>
              </ToggletipContent>
            </Toggletip>
          </SubGrid>
          <SubGrid label="InlineLoading state transition">
            <InlineLoading description="A submeter…" status="active" />
            <InlineLoading description="Submetido com sucesso" status="finished" />
            <InlineLoading description="Falha — tente novamente" status="error" />
          </SubGrid>
        </Stack>
      </Tile>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  id,
  title,
  caption,
  children,
}: {
  id: string;
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-12">
      <div className="mb-4">
        <h2 style={{ fontSize: "1.5rem", fontWeight: 400, lineHeight: 1.33, margin: 0 }}>
          {title}
        </h2>
        {caption && <p className="mt-1 text-sm text-neutral-600">{caption}</p>}
      </div>
      {children}
    </section>
  );
}
