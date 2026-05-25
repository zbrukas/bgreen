import { Tile } from "@carbon/react";
import Link from "next/link";
import { SetupPasswordForm } from "./SetupPasswordForm";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function SetupPasswordPage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          bGreen · Central Services
        </p>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 400, letterSpacing: "0.16px", margin: 0 }}>
          Definir palavra-passe
        </h1>
        <p className="mt-1 text-sm text-neutral-700">
          A sua conta ainda não tem palavra-passe. Escolha uma com pelo menos 12 caracteres.
        </p>
      </div>
      <Tile>
        <SetupPasswordForm defaultEmail={email ?? ""} />
      </Tile>
      <p className="text-center text-xs text-neutral-500">
        <Link href="/login" className="text-[var(--cds-link-primary)] hover:underline">
          ← Voltar ao início de sessão
        </Link>
      </p>
    </main>
  );
}
