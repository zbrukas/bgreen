import { fetchInvitePreview } from "@/lib/api-client";
import { Tile } from "@carbon/react";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { AcceptInviteButton } from "./AcceptInviteButton";

export const dynamic = "force-dynamic";

const errorCopy: Record<string, string> = {
  not_found: "Este convite não existe ou foi removido.",
  email_mismatch:
    "Este convite foi enviado para outro endereço de email. Inicie sessão com o email convidado.",
  expired: "Este convite expirou.",
  already_accepted: "Este convite já foi aceite.",
  revoked: "Este convite foi revogado.",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteAcceptPage({ params }: PageProps) {
  const { token } = await params;
  const auth = await withAuth();

  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8">
        <h1 style={{ fontSize: "1.75rem", fontWeight: 400, letterSpacing: "0.16px", margin: 0 }}>
          Convite bGreen
        </h1>
        <p className="text-sm text-neutral-700">
          Inicie sessão para ver o convite. O email da sua conta deve corresponder ao convidado.
        </p>
        <p>
          <a
            href={signInUrl}
            className="text-[var(--cds-link-primary)] hover:underline"
          >
            Iniciar sessão
          </a>
        </p>
      </main>
    );
  }

  const preview = await fetchInvitePreview(token);

  if ("error" in preview) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
        <h1 style={{ fontSize: "1.75rem", fontWeight: 400, letterSpacing: "0.16px", margin: 0 }}>
          Convite bGreen
        </h1>
        <p>{errorCopy[preview.error] ?? `Erro: ${preview.error}`}</p>
        <p>
          <Link href="/" className="text-[var(--cds-link-primary)] hover:underline">
            Voltar à página inicial
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8">
      <h1 style={{ fontSize: "1.75rem", fontWeight: 400, letterSpacing: "0.16px", margin: 0 }}>
        Convite bGreen
      </h1>
      <Tile>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 400, lineHeight: 1.28, margin: 0 }}>
          {preview.organizationName}
        </h2>
        <p className="mt-3 text-sm">
          <strong>{preview.inviterEmail}</strong> convidou-o(a) para se juntar como{" "}
          <strong>{preview.role === "org_admin" ? "administrador" : "membro"}</strong>.
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          O convite expira em{" "}
          {new Date(preview.expiresAt).toLocaleString("pt-PT", {
            dateStyle: "long",
            timeStyle: "short",
          })}
          .
        </p>
        <div className="mt-4">
          <AcceptInviteButton token={token} />
        </div>
      </Tile>
    </main>
  );
}
