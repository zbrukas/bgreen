import { PageHeader } from "@bgreen/ui";
import { fetchMe } from "@/lib/api-client";
import { Dashboard } from "@carbon/icons-react";
import {
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from "@carbon/react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  maintainer: "Maintainer",
  promoter: "Promoter",
};

const ROLE_TAG: Record<string, "purple" | "blue" | "cool-gray"> = {
  admin: "purple",
  maintainer: "blue",
  promoter: "cool-gray",
};

export default async function Home() {
  // Middleware guarantees a cs_session cookie. If the API doesn't know
  // the user (token expired, user deleted) we kick back to /login.
  const me = await fetchMe();
  if (!me) redirect("/login");

  return (
    <>
      <PageHeader
        title="Consola Central Services"
        description="Aqui mantemos os modelos, gerimos as organizações e revemos submissões."
        icon={Dashboard}
      />
      <div className="space-y-6 px-8 py-6">
        <section>
          <h2
            className="mb-3"
            style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}
          >
            Sessão
          </h2>
          <p className="mb-3 text-sm text-neutral-600">Detalhes do utilizador autenticado.</p>
          <StructuredListWrapper>
            <StructuredListHead>
              <StructuredListRow head>
                <StructuredListCell head>Campo</StructuredListCell>
                <StructuredListCell head>Valor</StructuredListCell>
              </StructuredListRow>
            </StructuredListHead>
            <StructuredListBody>
              <StructuredListRow>
                <StructuredListCell>Email</StructuredListCell>
                <StructuredListCell>
                  <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8125rem" }}>
                    {me.email}
                  </code>
                </StructuredListCell>
              </StructuredListRow>
              <StructuredListRow>
                <StructuredListCell>Papel CS</StructuredListCell>
                <StructuredListCell>
                  {me.centralServicesRole ? (
                    <Tag type={ROLE_TAG[me.centralServicesRole] ?? "cool-gray"}>
                      {ROLE_LABEL[me.centralServicesRole] ?? me.centralServicesRole}
                    </Tag>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </StructuredListCell>
              </StructuredListRow>
            </StructuredListBody>
          </StructuredListWrapper>
        </section>
      </div>
    </>
  );
}
