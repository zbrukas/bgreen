import { InlineNotification, Tile } from "@carbon/react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ setupSent?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { setupSent } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          bGreen · Central Services
        </p>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 400, letterSpacing: "0.16px", margin: 0 }}>
          Iniciar sessão
        </h1>
        <p className="mt-1 text-sm text-neutral-700">
          Inicie sessão com o seu email e palavra-passe.
        </p>
      </div>
      {setupSent ? (
        <InlineNotification
          kind="success"
          title="Palavra-passe definida"
          subtitle="Pode iniciar sessão."
          lowContrast
          hideCloseButton
        />
      ) : null}
      <Tile>
        <LoginForm />
      </Tile>
    </main>
  );
}
