import Link from "next/link";
import { signOutAction } from "../actions";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

interface HeaderProps {
  userEmail: string;
  organizations: Array<{ id: string; name: string }>;
  activeOrganizationId: string | null;
}

export function Header({ userEmail, organizations, activeOrganizationId }: HeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.75rem 1rem",
        borderBottom: "1px solid #e5e5e5",
        fontFamily: "system-ui, sans-serif",
        flexWrap: "wrap",
      }}
    >
      <strong style={{ fontSize: "1.1rem" }}>bGreen</strong>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        {organizations.length >= 2 && (
          <OrganizationSwitcher
            organizations={organizations}
            activeOrganizationId={activeOrganizationId}
          />
        )}
        {organizations.length >= 1 && (
          <Link href="/organizations/new" style={{ fontSize: "0.9rem", textDecoration: "none" }}>
            + Nova organização
          </Link>
        )}
        <span style={{ fontSize: "0.9rem", color: "#555" }}>{userEmail}</span>
        <form action={signOutAction}>
          <button type="submit" style={{ padding: "0.35rem 0.75rem" }}>
            Sair
          </button>
        </form>
      </nav>
    </header>
  );
}
