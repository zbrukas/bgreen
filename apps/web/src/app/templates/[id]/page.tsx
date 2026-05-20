import { archiveTemplateAction, publishTemplateAction } from "@/app/actions";
import { fetchMe, fetchTemplate } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const fieldKindLabel: Record<string, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  select: "Lista",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.user) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p>Inicie sessão para ver o modelo.</p>
      </main>
    );
  }

  const [me, tpl] = await Promise.all([fetchMe(), fetchTemplate(id)]);
  if (!tpl) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/templates">← Voltar</Link>
        </p>
        <p>Modelo não encontrado.</p>
      </main>
    );
  }
  const isAdmin = me?.activeOrganizationRole === "admin";

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/templates">← Voltar</Link>
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 0.25rem" }}>{tpl.name}</h1>
          <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
            Estado: <strong>{statusLabel[tpl.status] ?? tpl.status}</strong>
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {tpl.status === "draft" && (
              <form action={publishTemplateAction}>
                <input type="hidden" name="id" value={tpl.id} />
                <button type="submit" style={{ padding: "0.4rem 0.75rem", fontSize: "0.9rem" }}>
                  Publicar
                </button>
              </form>
            )}
            {tpl.status !== "archived" && (
              <form action={archiveTemplateAction}>
                <input type="hidden" name="id" value={tpl.id} />
                <button type="submit" style={{ padding: "0.4rem 0.75rem", fontSize: "0.9rem" }}>
                  Arquivar
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {tpl.description && (
        <p style={{ color: "#555", marginBottom: "1.5rem" }}>{tpl.description}</p>
      )}

      <h2 style={{ fontSize: "1.05rem", margin: "1rem 0 0.5rem" }}>Campos</h2>
      <ol style={{ display: "grid", gap: "0.5rem", padding: 0, margin: 0, listStyle: "none" }}>
        {tpl.formSchema.rows.flatMap((row) =>
          row.fields.map((field) => (
            <li
              key={field.id}
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #e0e0e0",
                borderRadius: "0.25rem",
                background: "#fafafa",
                fontSize: "0.95rem",
              }}
            >
              <code style={{ fontFamily: "monospace", color: "#1f7a3d" }}>{field.id}</code>
              <span style={{ margin: "0 0.5rem" }}>•</span>
              <strong>{field.label}</strong>
              <span style={{ color: "#777", margin: "0 0.5rem" }}>
                ({fieldKindLabel[field.kind] ?? field.kind}
                {field.required ? ", obrigatório" : ""})
              </span>
              {field.kind === "number" && field.unit && (
                <span style={{ color: "#555" }}>{field.unit}</span>
              )}
              {field.kind === "select" && (
                <ul style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#555" }}>
                  {field.options.map((opt) => (
                    <li key={opt.value}>
                      <code>{opt.value}</code> — {opt.label}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )),
        )}
      </ol>
    </main>
  );
}
