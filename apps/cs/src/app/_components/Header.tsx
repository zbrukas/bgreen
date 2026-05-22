import { Button } from "@/components/ui/button";
import Link from "next/link";
import { signOutAction } from "../actions";

interface HeaderProps {
  userEmail: string;
  role: "admin" | "maintainer" | "promoter" | null;
}

const roleLabel: Record<string, string> = {
  admin: "Admin",
  maintainer: "Maintainer",
  promoter: "Promoter",
};

export function Header({ userEmail, role }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
        bGreen · Central Services
      </Link>
      <nav className="flex flex-wrap items-center gap-3">
        <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">
          Modelos
        </Link>
        <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">
          Revisão
        </Link>
        <Link href="/orgs" className="text-sm text-muted-foreground hover:text-foreground">
          Organizações
        </Link>
        <Link href="/users" className="text-sm text-muted-foreground hover:text-foreground">
          Utilizadores CS
        </Link>
        <Link href="/domains" className="text-sm text-muted-foreground hover:text-foreground">
          Domínios
        </Link>
        <Link href="/topics" className="text-sm text-muted-foreground hover:text-foreground">
          Tópicos
        </Link>
        <span className="text-sm text-muted-foreground">
          {userEmail}
          {role ? <span className="ml-1 text-xs">({roleLabel[role] ?? role})</span> : null}
        </span>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </nav>
    </header>
  );
}
