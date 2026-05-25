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
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
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

// Both apps share the same default density (md). CS was originally planned
// as compact; that decision was reversed during Phase 0 review. Constant
// kept as a single swap-point in case we revisit per-app density later.
const SIZE = "md" as const;

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
        <div className="mx-auto grid max-w-[1400px] grid-cols-[200px_minmax(0,1fr)] gap-10 px-6 py-10">
          <TOC />
          <main className="min-w-0">
            <PageHero />
            <Stack gap={8}>
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
    <aside className="sticky top-10 self-start">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        Secções
      </p>
      <nav className="flex flex-col gap-0.5">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {s.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

function PageHero() {
  return (
    <header className="mb-10">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        bGreen · Central Services · Design system · Fase 0
      </p>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 300, letterSpacing: "0.16px", margin: 0 }}>
        Carbon themed for bGreen — Central Services
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-700">
        Mirror do showcase em <code className="rounded bg-neutral-100 px-1 text-xs">apps/web</code>.
        Mesma densidade nos dois apps — vocabulário ajustado para revisão de submissões e gestão
        de modelos.
      </p>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Typography
// ─────────────────────────────────────────────────────────────────────────────

function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      caption="IBM Plex Sans · idêntico ao apps/web"
    >
      <Tile>
        <div className="space-y-3">
          <TypeRow token="heading-05" label="Heading 05 · 28 / 36">
            <span style={{ fontSize: "1.75rem", fontWeight: 400, lineHeight: 1.28 }}>
              Modelos de registo
            </span>
          </TypeRow>
          <TypeRow token="heading-04" label="Heading 04 · 20 / 28">
            <span style={{ fontSize: "1.25rem", fontWeight: 400, lineHeight: 1.4 }}>
              Submissões a aguardar revisão
            </span>
          </TypeRow>
          <TypeRow token="heading-03" label="Heading 03 · 16 / 22">
            <span style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375 }}>
              Indicadores chave
            </span>
          </TypeRow>
          <TypeRow token="body-01" label="Body 01 · 14 / 20">
            <span style={{ fontSize: "0.875rem", lineHeight: 1.43 }}>
              Indique se aprova, pede alterações ou rejeita esta submissão.
            </span>
          </TypeRow>
          <TypeRow token="helper-text-01" label="Helper · 12 / 16">
            <span style={{ fontSize: "0.75rem", lineHeight: 1.33, color: "var(--cds-text-helper)" }}>
              Promoter — pode publicar modelos.
            </span>
          </TypeRow>
          <TypeRow token="code-01" label="Code · Plex Mono">
            <code
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "0.75rem",
                lineHeight: 1.33,
              }}
            >
              tpl_01J9KX… · 2026-05-25T10:42:00Z
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
    <div className="grid grid-cols-[160px_1fr] items-baseline gap-4 border-b border-neutral-200 pb-2 last:border-b-0 last:pb-0">
      <div>
        <p className="text-[11px] font-semibold text-neutral-900">{label}</p>
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
    <Section
      id="colour"
      title="Colour tokens"
      caption="Idêntico ao apps/web — tokens são partilhados via carbon-theme.css"
    >
      <Stack gap={4}>
        <ColourBlock
          title="Brand"
          swatches={[
            { name: "mint leaf", hex: "#63B995" },
            { name: "shadow grey", hex: "#37323E" },
          ]}
        />
        <ColourBlock
          title="Semantic"
          swatches={[
            { name: "cinnabar", hex: "#FF312E" },
            { name: "jasmine", hex: "#FFD97D" },
            { name: "fern", hex: "#50723C" },
          ]}
        />
        <ColourBlock
          title="Neutrals — Carbon gray scale"
          swatches={[
            { name: "shadow grey", hex: "#37323E" },
            { name: "gray-80", hex: "#393939" },
            { name: "gray-60", hex: "#6f6f6f" },
            { name: "gray-30", hex: "#c6c6c6" },
            { name: "gray-10", hex: "#f4f4f4" },
            { name: "white", hex: "#ffffff" },
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
  swatches: Array<{ name: string; hex: string }>;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-neutral-900">{title}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {swatches.map((s) => (
          <div key={s.name} className="overflow-hidden border border-neutral-200">
            <div className="h-10" style={{ backgroundColor: s.hex }} />
            <div className="p-1.5">
              <p className="text-[10px] font-semibold text-neutral-900">{s.name}</p>
              <p
                className="text-[9px] text-neutral-500"
                style={{ fontFamily: "'IBM Plex Mono'" }}
              >
                {s.hex}
              </p>
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
  { Icon: OverflowMenuVertical, name: "OverflowMenu" },
  { Icon: ChevronRight, name: "ChevronRight" },
  { Icon: ChevronLeft, name: "ChevronLeft" },
  { Icon: ArrowUp, name: "ArrowUp" },
  { Icon: ArrowDown, name: "ArrowDown" },
  { Icon: CheckmarkOutline, name: "Checkmark" },
  { Icon: WarningAlt, name: "Warning" },
  { Icon: ErrorOutline, name: "Error" },
  { Icon: Information, name: "Information" },
  { Icon: Help, name: "Help" },
  { Icon: Logout, name: "Logout" },
] as const;

function IconsSection() {
  return (
    <Section id="icons" title="Icons" caption="16 px é o tamanho padrão para CS em barras de acção.">
      <Tile>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-10">
          {ICONS.map(({ Icon, name }) => (
            <div
              key={name}
              className="flex flex-col items-center gap-0.5 border border-neutral-200 p-2"
            >
              <Icon size={16} />
              <code
                className="text-[9px] text-neutral-600"
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. Buttons
// ─────────────────────────────────────────────────────────────────────────────

function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      caption={`Carbon Button · size="${SIZE}" · idêntico ao apps/web`}
    >
      <Tile>
        <Stack gap={5}>
          <SubGrid label="Kind">
            <Button size={SIZE} kind="primary">
              Publicar modelo
            </Button>
            <Button size={SIZE} kind="secondary">
              Guardar
            </Button>
            <Button size={SIZE} kind="tertiary">
              Cancelar
            </Button>
            <Button size={SIZE} kind="ghost">
              Voltar
            </Button>
            <DangerButton size={SIZE}>Arquivar</DangerButton>
          </SubGrid>
          <SubGrid label="With leading icon">
            <Button size={SIZE} kind="primary" renderIcon={Add}>
              Novo modelo
            </Button>
            <Button size={SIZE} kind="secondary" renderIcon={Download}>
              Exportar
            </Button>
            <Button size={SIZE} kind="tertiary" renderIcon={Filter}>
              Filtrar
            </Button>
            <Button size={SIZE} kind="ghost" renderIcon={ArrowRight}>
              Continuar
            </Button>
          </SubGrid>
          <SubGrid label="Icon-only · loading">
            <IconButton size={SIZE} label="Editar" kind="ghost">
              <Edit />
            </IconButton>
            <IconButton size={SIZE} label="Eliminar" kind="ghost">
              <TrashCan />
            </IconButton>
            <IconButton size={SIZE} label="Mais opções" kind="ghost">
              <OverflowMenuVertical />
            </IconButton>
            <Button size={SIZE} kind="primary" disabled>
              Desactivado
            </Button>
            <InlineLoading description="A publicar…" status="active" />
          </SubGrid>
          <SubGrid label="ButtonSet — paired actions">
            <ButtonSet>
              <Button size={SIZE} kind="secondary">
                Cancelar
              </Button>
              <Button size={SIZE} kind="primary">
                Confirmar
              </Button>
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
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Tags
// ─────────────────────────────────────────────────────────────────────────────

function TagsSection() {
  return (
    <Section id="tags" title="Tags" caption="Estados de registo + tier de score (V8)">
      <Tile>
        <Stack gap={5}>
          <SubGrid label="Record status">
            <Tag type="cool-gray">
              Rascunho
            </Tag>
            <Tag type="blue">
              Submetido
            </Tag>
            <Tag type="green">
              Aprovado
            </Tag>
            <Tag type="warm-gray">
              Arquivado
            </Tag>
            <Tag type="magenta">
              Alterações pedidas
            </Tag>
            <Tag type="red">
              Rejeitado
            </Tag>
          </SubGrid>
          <SubGrid label="Score tier">
            <Tag type="green">
              Tier A
            </Tag>
            <Tag type="blue">
              Tier B
            </Tag>
            <Tag type="purple">
              Tier C
            </Tag>
            <Tag type="warm-gray">
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
// 6. PageHeader
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
    <div className="border-b border-neutral-200 pb-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-1.5">
          {breadcrumbs.map((b, i) => (
            <BreadcrumbItem key={i} href={b.href} isCurrentPage={i === breadcrumbs.length - 1}>
              {b.label}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          {Icon && (
            <div className="mt-0.5 text-[var(--cds-icon-primary)]">
              <Icon size={20} />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 400, lineHeight: 1.4, margin: 0 }}>
              {title}
            </h1>
            {description && (
              <p
                className="mt-0.5 max-w-2xl text-neutral-700"
                style={{ fontSize: "0.8125rem", lineHeight: 1.43 }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
    </div>
  );
}

function PageHeaderSection() {
  return (
    <Section
      id="page-header"
      title="PageHeader"
      caption="Cabeçalho de página · ícone + título + descrição + acções"
    >
      <Stack gap={3}>
        <Tile>
          <PageHeader
            title="Revisão"
            description="Submissões a aguardar aprovação por toda a organização."
          />
        </Tile>
        <Tile>
          <PageHeader
            title="ESG 2026 — anual"
            description="Modelo publicado · 22 organizações utilizam-no actualmente."
            icon={Document}
            breadcrumbs={[
              { label: "Modelos", href: "/templates" },
              { label: "ESG 2026" },
            ]}
            actions={
              <>
                <Button size={SIZE} kind="ghost" renderIcon={Edit}>
                  Editar
                </Button>
                <Button size={SIZE} kind="primary" renderIcon={Add}>
                  Nova versão
                </Button>
              </>
            }
          />
        </Tile>
      </Stack>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. StatCard
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
        <div className="flex items-center gap-1.5 text-neutral-600">
          {Icon && <Icon size={14} />}
          <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        {tier && (
          <Tag type={tier.type}>
            {tier.label}
          </Tag>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          style={{ fontSize: "1.5rem", fontWeight: 400, lineHeight: 1, letterSpacing: "-0.4px" }}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-neutral-600">{unit}</span>}
      </div>
      {delta && (
        <div className="mt-1 flex items-center gap-1 text-[11px]">
          {delta.direction === "up" && (
            <ArrowUp size={10} style={{ color: "var(--cds-support-success)" }} />
          )}
          {delta.direction === "down" && (
            <ArrowDown size={10} style={{ color: "var(--cds-support-error)" }} />
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
          <span className="text-neutral-500">vs. anterior</span>
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3">
          <MiniSparkline values={sparkline} />
        </div>
      )}
    </Tile>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const w = 180;
  const h = 32;
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
      caption="KPI cards do dashboard CS · pares com benchmarks de plataforma"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Organizações activas"
          value="247"
          delta={{ value: "+12", direction: "up" }}
          icon={Building}
        />
        <StatCard
          label="Pendentes revisão"
          value="18"
          delta={{ value: "-3", direction: "down" }}
          icon={NotificationIcon}
        />
        <StatCard
          label="Score médio ESG"
          value="64"
          unit="/ 100"
          tier={{ label: "Tier B", type: "blue" }}
          sparkline={[58, 60, 62, 61, 63, 64]}
          icon={Document}
        />
        <StatCard
          label="Templates publicados"
          value="14"
          delta={{ value: "+2", direction: "up" }}
          icon={Document}
        />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. EmptyState
// ─────────────────────────────────────────────────────────────────────────────

function EmptyStateIllustration() {
  return (
    <svg width={96} height={72} viewBox="0 0 96 72" role="img" aria-label="">
      <rect x="16" y="12" width="64" height="48" fill="#f4f4f4" stroke="#c6c6c6" />
      <rect x="22" y="18" width="32" height="4" fill="#c6c6c6" />
      <rect x="22" y="28" width="52" height="3" fill="#e0e0e0" />
      <rect x="22" y="35" width="40" height="3" fill="#e0e0e0" />
      <rect x="22" y="42" width="48" height="3" fill="#e0e0e0" />
      <circle cx="48" cy="54" r="4" fill="#1f7a3d" opacity="0.2" />
      <circle cx="48" cy="54" r="2" fill="#1f7a3d" />
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
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <EmptyStateIllustration />
        <div className="max-w-md">
          <h3 style={{ fontSize: "1rem", fontWeight: 500, margin: 0 }}>{title}</h3>
          <p className="mt-0.5 text-xs text-neutral-700">{description}</p>
        </div>
        {(primaryAction || secondaryAction) && (
          <ButtonSet>
            {secondaryAction && (
              <Button size={SIZE} kind="secondary" renderIcon={secondaryAction.icon}>
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button size={SIZE} kind="primary" renderIcon={primaryAction.icon}>
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
    <Section id="empty-state" title="EmptyState" caption="Padrão usado em inbox vazia, revisão, e tópicos sem submissões">
      <div className="grid gap-3 lg:grid-cols-2">
        <EmptyState
          title="Sem submissões a rever"
          description="Quando organizações submeterem registos, aparecerão aqui."
          primaryAction={{ label: "Configurar notificações", icon: NotificationIcon }}
        />
        <EmptyState
          title="Sem modelos publicados"
          description="Crie um novo modelo a partir do zero ou duplique um existente."
          primaryAction={{ label: "Novo modelo", icon: Add }}
          secondaryAction={{ label: "Duplicar modelo", icon: Document }}
        />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. DataTable
// ─────────────────────────────────────────────────────────────────────────────

const SUBMISSIONS = [
  {
    id: "s1",
    org: "Organização Exemplo, Lda",
    template: "ESG 2026 — anual",
    status: "submitted",
    statusLabel: "Submetido",
    submittedAt: "2026-05-20 10:42",
    score: 72,
  },
  {
    id: "s2",
    org: "Outra Empresa SA",
    template: "Auditoria energética",
    status: "submitted",
    statusLabel: "Submetido",
    submittedAt: "2026-05-22 09:18",
    score: 55,
  },
  {
    id: "s3",
    org: "Pequena Lda",
    template: "ESG 2026 — anual",
    status: "approved",
    statusLabel: "Aprovado",
    submittedAt: "2026-04-12 16:01",
    score: 68,
  },
  {
    id: "s4",
    org: "Terceira ETI",
    template: "Inquérito GHG",
    status: "changes_requested",
    statusLabel: "Alterações pedidas",
    submittedAt: "2026-05-23 11:05",
    score: 41,
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
  return (
    <Tag type={STATUS_TAG[s] ?? "cool-gray"}>
      {label}
    </Tag>
  );
}

function DataTableSection() {
  return (
    <Section
      id="data-table"
      title="DataTable"
      caption="Carbon TableContainer · usado pelo inbox de revisão"
    >
      <TableContainer
        title="Pendentes de revisão"
        description="4 submissões aguardam decisão."
      >
        <TableToolbar>
          <TableToolbarContent>
            <TableToolbarSearch onChange={() => undefined} />
            <Button size={SIZE} kind="ghost" renderIcon={Filter}>
              Filtrar
            </Button>
          </TableToolbarContent>
        </TableToolbar>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Organização</TableHeader>
              <TableHeader>Modelo</TableHeader>
              <TableHeader>Estado</TableHeader>
              <TableHeader>Submetido</TableHeader>
              <TableHeader>Score</TableHeader>
              <TableHeader />
            </TableRow>
          </TableHead>
          <TableBody>
            {SUBMISSIONS.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.org}</TableCell>
                <TableCell>{s.template}</TableCell>
                <TableCell>{statusTag(s.status, s.statusLabel)}</TableCell>
                <TableCell>{s.submittedAt}</TableCell>
                <TableCell>{s.score} / 100</TableCell>
                <TableCell>
                  <OverflowMenu flipped aria-label="Acções">
                    <OverflowMenuItem itemText="Rever" />
                    <OverflowMenuItem itemText="Ver histórico" />
                    <OverflowMenuItem itemText="Rejeitar" isDelete hasDivider />
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
      caption="Read-only — perfil da sessão CS, detalhes da organização sob revisão"
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
            <StructuredListCell>Utilizador</StructuredListCell>
            <StructuredListCell>
              <code style={{ fontFamily: "'IBM Plex Mono'" }}>cs.user@bgreen.io</code>
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Papel</StructuredListCell>
            <StructuredListCell>
              <Tag type="cool-gray">
                Maintainer
              </Tag>
            </StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Domínios atribuídos</StructuredListCell>
            <StructuredListCell>Ambiente, Social</StructuredListCell>
          </StructuredListRow>
          <StructuredListRow>
            <StructuredListCell>Última sessão</StructuredListCell>
            <StructuredListCell>2026-05-25 08:14</StructuredListCell>
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
      caption="Inline · contexto de revisão e publicação"
    >
      <Stack gap={3}>
        <InlineNotification
          kind="info"
          title="Versão em rascunho"
          subtitle="As alterações só ficam visíveis para organizações depois de publicar."
          lowContrast
        />
        <InlineNotification
          kind="success"
          title="Modelo publicado"
          subtitle="Organizações já podem submeter registos contra esta versão."
          lowContrast
        />
        <InlineNotification
          kind="warning"
          title="Score schema inconsistente"
          subtitle="2 campos têm scoring sem maxScore definido — verifique antes de publicar."
          lowContrast
        />
        <InlineNotification
          kind="error"
          title="Falha ao guardar"
          subtitle="Erro na ligação ao API. Tente novamente."
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
      caption="Form inputs Carbon · usados pelo editor de modelos e pelo formulário de revisão"
    >
      <Tile>
        <Stack gap={5}>
          <FormGroup legendText="Definição do modelo">
            <Stack gap={4}>
              <TextInput
                size={SIZE}
                id="tpl-id"
                labelText="ID do modelo"
                helperText="Identificador único — kebab-case."
                placeholder="ex: esg-anual-2026"
              />
              <TextInput
                size={SIZE}
                id="tpl-name"
                labelText="Nome legível"
                value="ESG 2026 — anual"
                readOnly
              />
              <TextInput
                size={SIZE}
                id="tpl-bad"
                labelText="ID com espaços (inválido)"
                value="esg 2026"
                invalid
                invalidText="O ID não pode conter espaços."
              />
            </Stack>
          </FormGroup>

          <FormGroup legendText="Scoring">
            <Stack gap={4}>
              <NumberInput
                size={SIZE}
                id="max-score"
                label="Score máximo"
                value={100}
                step={1}
                min={0}
              />
              <Select size={SIZE} id="agg" labelText="Agregação (campos repetidos)" defaultValue="sum">
                <SelectItem value="sum" text="sum — soma" />
                <SelectItem value="avg" text="avg — média" />
                <SelectItem value="min" text="min" />
                <SelectItem value="max" text="max" />
              </Select>
              <Dropdown
                size={SIZE}
                id="bucket-strategy"
                titleText="Estratégia de buckets"
                label="Selecione"
                items={["Linear (0–50, 50–80, 80–100)", "Personalizada"]}
                initialSelectedItem="Linear (0–50, 50–80, 80–100)"
              />
            </Stack>
          </FormGroup>

          <FormGroup legendText="Decisão de revisão">
            <RadioButtonGroup name="cs-decision" orientation="vertical" legendText="">
              <RadioButton labelText="Aprovar" value="approve" id="csd-1" />
              <RadioButton labelText="Pedir alterações" value="changes" id="csd-2" />
              <RadioButton labelText="Rejeitar" value="reject" id="csd-3" />
            </RadioButtonGroup>
          </FormGroup>

          <CheckboxGroup legendText="Cobertura framework">
            <Checkbox labelText="ESRS E1" id="cb-cs-1" defaultChecked />
            <Checkbox labelText="GHG Protocol" id="cb-cs-2" />
            <Checkbox labelText="GRI 305" id="cb-cs-3" defaultChecked />
          </CheckboxGroup>

          <TextArea
            id="cs-comment"
            labelText="Comentário"
            placeholder="Notas para a organização…"
            rows={3}
          />

          <FileUploader
            labelTitle="Anexar evidência"
            labelDescription="PDF ou imagem. Máximo 10 MB."
            buttonLabel="Escolher ficheiro"
            buttonKind="primary"
            size={SIZE}
            filenameStatus="edit"
            accept={[".pdf", ".png", ".jpg"]}
            iconDescription="Limpar"
          />

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Importação em curso
            </p>
            <ProgressBar
              label="A importar 142 registos"
              helperText="71 de 142"
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
      caption="Header + SideNav com itens específicos de Central Services"
    >
      <div className="overflow-hidden border border-neutral-200">
        <div className="relative" style={{ height: 440 }}>
          <Header aria-label="bGreen CS">
            <HeaderName href="#" prefix="bGreen">
              Central Services
            </HeaderName>
            <HeaderNavigation aria-label="navegação">
              <HeaderMenuItem href="#">Revisão</HeaderMenuItem>
              <HeaderMenuItem href="#">Modelos</HeaderMenuItem>
              <HeaderMenuItem href="#">Organizações</HeaderMenuItem>
              <HeaderMenuItem href="#">Domínios</HeaderMenuItem>
            </HeaderNavigation>
            <HeaderGlobalBar>
              <HeaderGlobalAction aria-label="Pesquisar">
                <Search size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="Sair">
                <Logout size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
          </Header>
          <SideNav aria-label="Side navigation" expanded isFixedNav={false}>
            <SideNavItems>
              <SideNavLink renderIcon={NotificationIcon} href="#" isActive>
                Revisão
              </SideNavLink>
              <SideNavLink renderIcon={Document} href="#">
                Modelos
              </SideNavLink>
              <SideNavLink renderIcon={Building} href="#">
                Organizações
              </SideNavLink>
              <SideNavDivider />
              <SideNavLink renderIcon={UserMultiple} href="#">
                Utilizadores CS
              </SideNavLink>
              <SideNavLink renderIcon={Settings} href="#">
                Domínios
              </SideNavLink>
              <SideNavLink renderIcon={Document} href="#">
                Tópicos
              </SideNavLink>
            </SideNavItems>
          </SideNav>
          <div
            className="absolute right-0 top-12 bottom-0 bg-neutral-50 p-4"
            style={{ left: 256 }}
          >
            <PageHeader
              title="Revisão"
              description="4 submissões pendentes."
              actions={
                <Button size={SIZE} kind="ghost" renderIcon={Filter}>
                  Filtrar
                </Button>
              }
            />
          </div>
        </div>
      </div>
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
      caption="Idêntico ao apps/web — tokens de motion são partilhados"
    >
      <Tile>
        <Stack gap={3}>
          <SubGrid label="Button hover">
            <Button size={SIZE} kind="primary">
              Hover-me
            </Button>
            <Button size={SIZE} kind="secondary">
              Hover-me
            </Button>
            <Button size={SIZE} kind="ghost">
              Hover-me
            </Button>
          </SubGrid>
          <SubGrid label="ClickableTile">
            <div className="flex gap-2" style={{ width: 420 }}>
              <ClickableTile href="#">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Novo modelo
                </p>
                <p className="mt-0.5 text-xs">Crie a partir do zero.</p>
              </ClickableTile>
              <ClickableTile href="#">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Duplicar
                </p>
                <p className="mt-0.5 text-xs">Use um modelo existente como base.</p>
              </ClickableTile>
            </div>
          </SubGrid>
          <SubGrid label="Toggletip">
            <Toggletip>
              <ToggletipButton label="Ajuda">
                <Help />
              </ToggletipButton>
              <ToggletipContent>
                <p>
                  Apenas Promoters podem publicar modelos. Maintainers podem editar rascunhos.
                </p>
                <ToggletipActions>
                  <Button size="sm" kind="ghost">
                    Saiba mais
                  </Button>
                </ToggletipActions>
              </ToggletipContent>
            </Toggletip>
          </SubGrid>
          <SubGrid label="InlineLoading">
            <InlineLoading description="A publicar…" status="active" />
            <InlineLoading description="Publicado" status="finished" />
            <InlineLoading description="Falha" status="error" />
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
    <section id={id} className="scroll-mt-10">
      <div className="mb-3">
        <h2 style={{ fontSize: "1.25rem", fontWeight: 400, lineHeight: 1.4, margin: 0 }}>
          {title}
        </h2>
        {caption && <p className="mt-0.5 text-xs text-neutral-600">{caption}</p>}
      </div>
      {children}
    </section>
  );
}
