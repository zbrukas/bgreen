import { PageHeader } from "@bgreen/ui";
import { fetchCsUsers, fetchMe } from "@/lib/api-client";
import { UserMultiple } from "@carbon/icons-react";
import { InlineNotification } from "@carbon/react";
import { redirect } from "next/navigation";
import { AddUserForm } from "./AddUserForm";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function CsUsersPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const isAdmin = me.centralServicesRole === "admin";
  const users = await fetchCsUsers();

  return (
    <>
      <PageHeader
        title="Utilizadores CS"
        description="Convide colegas para a consola e defina o papel. Cada novo utilizador define a sua palavra-passe ao iniciar sessão pela primeira vez."
        icon={UserMultiple}
      />
      <div className="space-y-6 px-8 py-6">
        {!isAdmin && (
          <InlineNotification
            kind="warning"
            title="Acesso limitado"
            subtitle="Apenas administradores CS podem adicionar/remover utilizadores ou alterar papéis."
            lowContrast
            hideCloseButton
          />
        )}

        {isAdmin && <AddUserForm />}

        <UsersTable
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            centralServicesRole: u.centralServicesRole,
            passwordSet: u.passwordSet,
            lastLoginAt: u.lastLoginAt,
          }))}
          isAdmin={isAdmin}
          currentUserId={me.id}
        />
      </div>
    </>
  );
}
