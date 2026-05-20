import { fetchMe, fetchTemplates } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export default async function TemplatesListPage() {
  const auth = await withAuth();
  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p>
          <a href={signInUrl}>Iniciar sessão</a> para ver os modelos.
        </p>
      </main>
    );
  }

  const [me, templates] = await Promise.all([fetchMe(), fetchTemplates()]);
  const isAdmin = me?.activeOrganizationRole === "admin";

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/">← Voltar</Link>
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Modelos de registo</h1>
        {isAdmin && (
          <Link
            href="/templates/new"
            style={{
              padding: "0.5rem 0.75rem",
              background: "#1f7a3d",
              color: "white",
              borderRadius: "0.25rem",
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            + Novo modelo
          </Link>
        )}
      </div>

      {templates.length === 0 ? (
        <p style={{ color: "#666" }}>
          Ainda não existem modelos.{" "}
          {isAdmin
            ? "Crie o primeiro para começar a recolher dados ESG."
            : "Peça a um administrador para criar um."}
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #e0e0e0",
            fontSize: "0.95rem",
          }}
        >
          <thead style={{ background: "#fafafa", textAlign: "left" }}>
            <tr>
              <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e0e0e0" }}>Nome</th>
              <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e0e0e0" }}>
                Estado
              </th>
              <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e0e0e0" }}>
                Campos
              </th>
              <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e0e0e0" }} />
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl) => {
              const fieldCount = tpl.formSchema.rows.reduce((n, r) => n + r.fields.length, 0);
              return (
                <tr key={tpl.id}>
                  <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f0f0f0" }}>
                    <Link href={`/templates/${tpl.id}`}>{tpl.name}</Link>
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f0f0f0" }}>
                    {statusLabel[tpl.status] ?? tpl.status}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f0f0f0" }}>
                    {fieldCount}
                  </td>
                  <td
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderBottom: "1px solid #f0f0f0",
                      textAlign: "right",
                    }}
                  >
                    <Link href={`/templates/${tpl.id}`}>Ver</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
