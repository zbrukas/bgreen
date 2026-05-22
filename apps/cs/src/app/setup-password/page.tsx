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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Definir palavra-passe</h1>
        <p className="text-sm text-muted-foreground">
          A sua conta ainda não tem palavra-passe. Escolha uma com pelo menos 12 caracteres.
        </p>
      </div>
      <SetupPasswordForm defaultEmail={email ?? ""} />
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/login" className="underline-offset-4 hover:underline">
          ← Voltar ao início de sessão
        </Link>
      </p>
    </main>
  );
}
