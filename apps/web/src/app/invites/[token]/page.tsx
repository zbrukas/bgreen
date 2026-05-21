import { acceptInviteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <main className="mx-auto max-w-xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Convite bGreen</h1>
        <p className="text-sm text-muted-foreground">
          Inicie sessão para ver o convite. O email da sua conta deve corresponder ao convidado.
        </p>
        <p>
          <a href={signInUrl} className="text-primary underline-offset-4 hover:underline">
            Iniciar sessão
          </a>
        </p>
      </main>
    );
  }

  const preview = await fetchInvitePreview(token);

  if ("error" in preview) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Convite bGreen</h1>
        <p>{errorCopy[preview.error] ?? `Erro: ${preview.error}`}</p>
        <p>
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Voltar à página inicial
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Convite bGreen</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{preview.organizationName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>{preview.inviterEmail}</strong> convidou-o(a) para se juntar como{" "}
            <strong>{preview.role === "admin" ? "administrador" : "membro"}</strong>.
          </p>
          <p className="text-muted-foreground">
            O convite expira em{" "}
            {new Date(preview.expiresAt).toLocaleString("pt-PT", {
              dateStyle: "long",
              timeStyle: "short",
            })}
            .
          </p>
          <form action={acceptInviteAction}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" size="lg">
              Aceitar convite
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
