"use client";

import { switchActiveOrganizationAction } from "@/app/actions";
import {
  Building,
  Dashboard,
  Document,
  DocumentPdf,
  ListChecked,
  Logout,
  Notification as NotificationIcon,
  Recommend,
  SidePanelClose,
  SidePanelOpen,
  UserAvatar,
  UserMultiple,
} from "@carbon/icons-react";
import {
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderName,
  HeaderPanel,
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Theme,
} from "@carbon/react";
import type { MembershipRole } from "@bgreen/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Dashboard;
  match: (pathname: string) => boolean;
}

const BASE_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Painel",
    icon: Dashboard,
    match: (p) => p.startsWith("/dashboard"),
  },
  {
    href: "/inbox",
    label: "Pendentes",
    icon: NotificationIcon,
    match: (p) => p.startsWith("/inbox"),
  },
  {
    href: "/records",
    label: "Registos",
    icon: Document,
    match: (p) => p.startsWith("/records"),
  },
  {
    href: "/economic-profile",
    label: "Perfil económico",
    icon: Building,
    match: (p) => p.startsWith("/economic-profile"),
  },
  {
    href: "/recommendations",
    label: "Recomendações",
    icon: Recommend,
    match: (p) => p.startsWith("/recommendations"),
  },
  {
    href: "/coverage",
    label: "Cobertura",
    icon: ListChecked,
    match: (p) => p.startsWith("/coverage"),
  },
  {
    href: "/templates",
    label: "Modelos",
    icon: Document,
    match: (p) => p.startsWith("/templates"),
  },
  {
    href: "/reports",
    label: "Relatórios",
    icon: DocumentPdf,
    match: (p) => p.startsWith("/reports"),
  },
];

interface AppShellProps {
  user: { email: string };
  organizations: Array<{ id: string; name: string }>;
  activeOrganizationId: string | null;
  activeOrganizationRole: MembershipRole | null;
  signOutAction: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  organizations,
  activeOrganizationId,
  activeOrganizationRole,
  signOutAction,
  children,
}: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const [isSideNavExpanded, setSideNavExpanded] = useState(true);
  const [isAccountOpen, setAccountOpen] = useState(false);
  const [isOrgOpen, setOrgOpen] = useState(false);

  const canInvite = activeOrganizationId !== null && activeOrganizationRole === "org_admin";
  const activeOrg = organizations.find((o) => o.id === activeOrganizationId) ?? null;

  const adminNav: NavItem[] = canInvite
    ? [
        {
          href: `/organizations/${activeOrganizationId}/members`,
          label: "Membros",
          icon: UserMultiple,
          match: (p) => p.includes("/members") || p.includes("/invites"),
        },
      ]
    : [];

  return (
    <Theme theme="white" data-carbon-theme="white">
      <Header aria-label="bGreen">
        <SkipToContent />
        <SideNavToggleButton
          expanded={isSideNavExpanded}
          onToggle={() => setSideNavExpanded((x) => !x)}
        />
        <HeaderName as={Link} href="/" prefix="bGreen">
          ESG
        </HeaderName>
        <HeaderGlobalBar>
          {organizations.length >= 2 && (
            <HeaderGlobalAction
              aria-label={activeOrg ? `Organização: ${activeOrg.name}` : "Mudar organização"}
              tooltipAlignment="end"
              isActive={isOrgOpen}
              onClick={() => {
                setOrgOpen((x) => !x);
                setAccountOpen(false);
              }}
            >
              <Building size={20} />
            </HeaderGlobalAction>
          )}
          <HeaderGlobalAction
            aria-label={user.email}
            tooltipAlignment="end"
            isActive={isAccountOpen}
            onClick={() => {
              setAccountOpen((x) => !x);
              setOrgOpen(false);
            }}
          >
            <UserAvatar size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>

        {organizations.length >= 2 && (
          <HeaderPanel aria-label="Organizações" expanded={isOrgOpen}>
            <div className="px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Mudar organização
              </p>
              <ul className="flex flex-col gap-1">
                {organizations.map((org) => (
                  <li key={org.id}>
                    <form action={switchActiveOrganizationAction}>
                      <input type="hidden" name="organizationId" value={org.id} />
                      <button
                        type="submit"
                        className={`flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-sm transition-colors ${
                          org.id === activeOrganizationId
                            ? "bg-white/10 text-white"
                            : "text-neutral-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="truncate">{org.name}</span>
                        {org.id === activeOrganizationId && (
                          <span className="text-[10px] uppercase tracking-wider text-emerald-300">
                            actual
                          </span>
                        )}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-white/10 pt-3">
                <Link
                  href="/organizations/new"
                  className="block rounded px-2 py-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
                  onClick={() => setOrgOpen(false)}
                >
                  + Nova organização
                </Link>
              </div>
            </div>
          </HeaderPanel>
        )}

        <HeaderPanel aria-label="Conta" expanded={isAccountOpen}>
          <div className="px-4 py-4">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Sessão</p>
            <p className="mt-1 break-all text-sm text-white">{user.email}</p>
            {activeOrganizationRole && (
              <p className="mt-2 text-xs text-neutral-300">
                Papel: <span className="text-white">{roleLabel(activeOrganizationRole)}</span>
              </p>
            )}
            <form action={signOutAction} className="mt-4 border-t border-white/10 pt-4">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
              >
                <Logout size={16} /> Sair
              </button>
            </form>
          </div>
        </HeaderPanel>
      </Header>

      <SideNav
        aria-label="Navegação"
        expanded={isSideNavExpanded}
        isPersistent
        isFixedNav
      >
        <SideNavItems>
          {[...BASE_NAV, ...adminNav].map((item) => {
            const Icon = item.icon;
            return (
              <SideNavLinkClient
                key={item.href}
                href={item.href}
                isActive={item.match(pathname)}
                renderIcon={Icon}
                label={item.label}
              />
            );
          })}
          {canInvite && activeOrganizationId && (
            <>
              <SideNavDivider />
              <SideNavLinkClient
                href={`/organizations/${activeOrganizationId}/invites/new`}
                isActive={pathname.includes("/invites/new")}
                renderIcon={UserMultiple}
                label="Convidar membro"
              />
            </>
          )}
        </SideNavItems>
      </SideNav>

      <main
        id="main-content"
        className="min-h-screen bg-white"
        style={{
          marginLeft: isSideNavExpanded ? "16rem" : 0,
          marginTop: "3rem",
          transition: "margin-left 240ms cubic-bezier(0.2, 0, 0.38, 0.9)",
        }}
      >
        {children}
      </main>
    </Theme>
  );
}

// Carbon's SideNavLink uses an <a> by default; wrapping in Next's <Link>
// gives us client-side navigation. The Carbon component accepts an `as`
// prop that swaps the underlying anchor element while preserving styling.
function SideNavLinkClient({
  href,
  isActive,
  renderIcon,
  label,
}: {
  href: string;
  isActive: boolean;
  renderIcon: NavItem["icon"];
  label: string;
}) {
  const router = useRouter();
  return (
    <SideNavLink
      href={href}
      isActive={isActive}
      renderIcon={renderIcon}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        router.push(href);
      }}
    >
      {label}
    </SideNavLink>
  );
}

// Replaces Carbon's HeaderMenuButton (which swaps Menu ≡ ↔ Close X)
// with side-panel iconography that conveys "this docked rail collapses
// sideways" instead of "this dismisses". Uses the same
// .cds--header__action / .cds--header__menu-trigger classes so it sits
// in the header chrome identically.
function SideNavToggleButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = expanded ? "Fechar navegação" : "Abrir navegação";
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      onClick={onToggle}
      className="cds--header__action cds--header__menu-trigger cds--header__menu-toggle cds--header__menu-toggle__hidden"
    >
      {expanded ? <SidePanelClose size={20} /> : <SidePanelOpen size={20} />}
    </button>
  );
}

function roleLabel(role: MembershipRole): string {
  switch (role) {
    case "org_admin":
      return "Administrador";
    case "org_user_write":
      return "Editor";
    case "org_user_read":
      return "Leitor";
    default:
      return role;
  }
}
