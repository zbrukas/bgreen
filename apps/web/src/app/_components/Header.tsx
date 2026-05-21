import { Button } from "@/components/ui/button";
import type { MembershipRole } from "@bgreen/types";
import Link from "next/link";
import { signOutAction } from "../actions";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

interface HeaderProps {
  userEmail: string;
  organizations: Array<{ id: string; name: string }>;
  activeOrganizationId: string | null;
  activeOrganizationRole: MembershipRole | null;
}

export function Header({
  userEmail,
  organizations,
  activeOrganizationId,
  activeOrganizationRole,
}: HeaderProps) {
  const canInvite = activeOrganizationId !== null && activeOrganizationRole === "admin";

  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
        bGreen
      </Link>
      <nav className="flex flex-wrap items-center gap-3">
        {organizations.length >= 2 && (
          <OrganizationSwitcher
            organizations={organizations}
            activeOrganizationId={activeOrganizationId}
          />
        )}
        <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
          Registos
        </Link>
        <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">
          Modelos
        </Link>
        {canInvite && activeOrganizationId && (
          <Link
            href={`/organizations/${activeOrganizationId}/invites/new`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Convidar membro
          </Link>
        )}
        {organizations.length >= 1 && (
          <Link
            href="/organizations/new"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            + Nova organização
          </Link>
        )}
        <span className="text-sm text-muted-foreground">{userEmail}</span>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </nav>
    </header>
  );
}
