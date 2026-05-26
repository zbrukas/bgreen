"use client";

import {
  Building,
  ChartLineSmooth,
  Document,
  Globe,
  Logout,
  Notification as NotificationIcon,
  SidePanelClose,
  SidePanelOpen,
  Tag as TagIcon,
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
import type { CentralServicesRole } from "@bgreen/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof NotificationIcon;
  match: (pathname: string) => boolean;
  roles?: CentralServicesRole[]; // undefined = visible to all CS users
}

const NAV: NavItem[] = [
  {
    href: "/inbox",
    label: "Revisão",
    icon: NotificationIcon,
    match: (p) => p.startsWith("/inbox"),
  },
  {
    href: "/templates",
    label: "Modelos",
    icon: Document,
    match: (p) => p.startsWith("/templates"),
  },
  {
    href: "/orgs",
    label: "Organizações",
    icon: Building,
    match: (p) => p.startsWith("/orgs"),
  },
  {
    href: "/health",
    label: "Saúde",
    icon: ChartLineSmooth,
    match: (p) => p.startsWith("/health"),
  },
  {
    href: "/topics",
    label: "Tópicos",
    icon: TagIcon,
    match: (p) => p.startsWith("/topics"),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    href: "/users",
    label: "Utilizadores CS",
    icon: UserMultiple,
    match: (p) => p.startsWith("/users"),
    roles: ["admin"],
  },
  {
    href: "/domains",
    label: "Domínios",
    icon: Globe,
    match: (p) => p.startsWith("/domains"),
    roles: ["admin"],
  },
];

interface AppShellProps {
  user: { email: string };
  role: CentralServicesRole | null;
  signOutAction: () => void;
  children: ReactNode;
}

const ROLE_LABEL: Record<CentralServicesRole, string> = {
  admin: "Admin",
  maintainer: "Maintainer",
  promoter: "Promoter",
};

export function AppShell({ user, role, signOutAction, children }: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const [isSideNavExpanded, setSideNavExpanded] = useState(true);
  const [isAccountOpen, setAccountOpen] = useState(false);

  const visibleAdmin = ADMIN_NAV.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <Theme theme="white" data-carbon-theme="white">
      <Header aria-label="bGreen Central Services">
        <SkipToContent />
        <SideNavToggleButton
          expanded={isSideNavExpanded}
          onToggle={() => setSideNavExpanded((x) => !x)}
        />
        <HeaderName as={Link} href="/" prefix="bGreen">
          Central Services
        </HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label={user.email}
            tooltipAlignment="end"
            isActive={isAccountOpen}
            onClick={() => setAccountOpen((x) => !x)}
          >
            <UserAvatar size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>

        <HeaderPanel aria-label="Conta" expanded={isAccountOpen}>
          <div className="px-4 py-4">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Sessão</p>
            <p className="mt-1 break-all text-sm text-white">{user.email}</p>
            {role && (
              <p className="mt-2 text-xs text-neutral-300">
                Papel: <span className="text-white">{ROLE_LABEL[role]}</span>
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

      <SideNav aria-label="Navegação" expanded={isSideNavExpanded} isPersistent isFixedNav>
        <SideNavItems>
          {NAV.map((item) => (
            <SideNavLinkClient
              key={item.href}
              href={item.href}
              isActive={item.match(pathname)}
              renderIcon={item.icon}
              label={item.label}
            />
          ))}
          {visibleAdmin.length > 0 && <SideNavDivider />}
          {visibleAdmin.map((item) => (
            <SideNavLinkClient
              key={item.href}
              href={item.href}
              isActive={item.match(pathname)}
              renderIcon={item.icon}
              label={item.label}
            />
          ))}
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
      className="cds--header__action cds--header__menu-trigger cds--header__menu-toggle"
    >
      {expanded ? <SidePanelClose size={20} /> : <SidePanelOpen size={20} />}
    </button>
  );
}
