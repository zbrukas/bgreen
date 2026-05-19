import { acceptInviteAction } from "@/app/actions";
import { fetchInvitePreview } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

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
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
        <h1>Convite bGreen</h1>
        <p>
          Inicie sessão para ver o convite. O email da sua conta deve corresponder ao convidado.
        </p>
        <p>
          <a href={signInUrl}>Iniciar sessão</a>
        </p>
      </main>
    );
  }

  const preview = await fetchInvitePreview(token);

  if ("error" in preview) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
        <h1>Convite bGreen</h1>
        <p>{errorCopy[preview.error] ?? `Erro: ${preview.error}`}</p>
        <p>
          <Link href="/">Voltar à página inicial</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <h1>Convite bGreen</h1>
      <p>
        <strong>{preview.inviterEmail}</strong> convidou-o(a) para se juntar a{" "}
        <strong>{preview.organizationName}</strong> como{" "}
        <strong>{preview.role === "admin" ? "administrador" : "membro"}</strong>.
      </p>
      <p style={{ color: "#555" }}>
        O convite expira em{" "}
        {new Date(preview.expiresAt).toLocaleString("pt-PT", {
          dateStyle: "long",
          timeStyle: "short",
        })}
        .
      </p>
      <form action={acceptInviteAction}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" style={{ padding: "0.75rem 1rem", fontSize: "1rem" }}>
          Aceitar convite
        </button>
      </form>
    </main>
  );
}
