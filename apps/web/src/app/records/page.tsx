import { fetchMe, fetchMyRecords, fetchTemplates } from "@/lib/api-client";
import type { Record as BgRecord } from "@bgreen/types";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  approved: "Aprovado",
  changes_requested: "Alterações pedidas",
  rejected: "Rejeitado",
};

const statusColor: Record<string, string> = {
  draft: "#777",
  submitted: "#01579b",
  approved: "#1f7a3d",
  changes_requested: "#bf6900",
  rejected: "#b00020",
};

export default async function RecordsListPage() {
  const auth = await withAuth();
  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p>
          <a href={signInUrl}>Iniciar sessão</a> para ver os registos.
        </p>
      </main>
    );
  }

  const [me, records, templates] = await Promise.all([
    fetchMe(),
    fetchMyRecords(),
    fetchTemplates(),
  ]);
  const templateNameById = new Map(templates.map((t) => [t.id, t.name]));
  const publishedTemplates = templates.filter((t) => t.status === "published");
  const isAdmin = me?.activeOrganizationRole === "admin";

  const pending = isAdmin ? records.filter((r) => r.status === "submitted") : [];
  const others = isAdmin ? records.filter((r) => r.status !== "submitted") : records;

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
        <h1 style={{ margin: 0 }}>{isAdmin ? "Registos da organização" : "Os meus registos"}</h1>
      </div>

      {publishedTemplates.length > 0 && (
        <section style={{ marginBottom: "1.5rem" }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.9rem", color: "#555" }}>
            Submeter um novo registo:
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {publishedTemplates.map((tpl) => (
              <Link
                key={tpl.id}
                href={`/records/new?template=${tpl.id}`}
                style={{
                  padding: "0.4rem 0.7rem",
                  background: "#e8f5e9",
                  color: "#1f7a3d",
                  borderRadius: "0.25rem",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                }}
              >
                + {tpl.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {isAdmin && (
        <RecordsTable
          title={`Pendentes de revisão${pending.length > 0 ? ` (${pending.length})` : ""}`}
          emptyMessage="Nenhum registo aguarda revisão."
          records={pending}
          templateNameById={templateNameById}
          actionLabel="Rever"
        />
      )}

      <RecordsTable
        title={isAdmin ? "Restantes registos" : "Os meus registos"}
        emptyMessage="Ainda não existem registos."
        records={others}
        templateNameById={templateNameById}
      />
    </main>
  );
}

interface RecordsTableProps {
  title: string;
  emptyMessage: string;
  records: BgRecord[];
  templateNameById: Map<string, string>;
  actionLabel?: string;
}

function RecordsTable({
  title,
  emptyMessage,
  records,
  templateNameById,
  actionLabel,
}: RecordsTableProps) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>{title}</h2>
      {records.length === 0 ? (
        <p style={{ color: "#666", fontSize: "0.9rem" }}>{emptyMessage}</p>
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
              <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e0e0e0" }}>
                Modelo
              </th>
              <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e0e0e0" }}>
                Estado
              </th>
              <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e0e0e0" }}>
                Submetido
              </th>
              <th style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #e0e0e0" }} />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f0f0f0" }}>
                  <Link href={`/records/${r.id}`}>
                    {templateNameById.get(r.templateId) ?? "(modelo removido)"}
                  </Link>
                </td>
                <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ color: statusColor[r.status] ?? "#333" }}>
                    {statusLabel[r.status] ?? r.status}
                  </span>
                </td>
                <td
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderBottom: "1px solid #f0f0f0",
                    color: "#555",
                  }}
                >
                  {r.submittedAt ? new Date(r.submittedAt).toLocaleString("pt-PT") : "—"}
                </td>
                <td
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderBottom: "1px solid #f0f0f0",
                    textAlign: "right",
                  }}
                >
                  <Link href={`/records/${r.id}`}>
                    {actionLabel ??
                      (r.status === "draft" || r.status === "changes_requested"
                        ? "Continuar"
                        : "Ver")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
