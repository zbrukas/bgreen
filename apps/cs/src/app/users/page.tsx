import { PageHeader } from "@bgreen/ui";
import { fetchCsUsers, fetchMe } from "@/lib/api-client";
import { CsUserListOptionsSchema } from "@bgreen/types";
import { UserMultiple } from "@carbon/icons-react";
import { InlineNotification } from "@carbon/react";
import { redirect } from "next/navigation";
import { AddUserForm } from "./AddUserForm";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CsUsersPage({ searchParams }: PageProps) {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const isAdmin = me.centralServicesRole === "admin";
  const raw = await searchParams;
  const parsed = CsUserListOptionsSchema.safeParse(raw);
  const options = parsed.success ? parsed.data : {};
  const pageSize = options.pageSize ?? 10;
  const page = options.page ?? 1;
  const { items: users, total } = await fetchCsUsers({ ...options, page, pageSize });

  return (
    <>
      <PageHeader
        title="Utilizadores CS"
        description="Convide colegas para a consola e defina o papel. Cada novo utilizador define a sua palavra-passe ao iniciar sessão pela primeira vez."
        icon={UserMultiple}
      />
      <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
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
          totalItems={total}
          page={page}
          pageSize={pageSize}
        />
      </div>
    </>
  );
}
