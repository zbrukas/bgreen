"use client";

import { deleteCsUserAction, updateCsUserRoleAction } from "@/app/actions";
import { type CsUserActionState, initialCsUserActionState } from "./users-action-state";
import { TrashCan } from "@carbon/icons-react";
import {
  Button,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@carbon/react";
import { useActionState } from "react";
import { FilterSelect } from "../_components/table-filter/FilterSelect";
import { SortHeader } from "../_components/table-filter/SortHeader";
import { TableFilterToolbar } from "../_components/table-filter/TableFilterToolbar";
import { TablePagination } from "../_components/table-filter/TablePagination";

const roleLabel: Record<string, string> = {
  admin: "Admin",
  maintainer: "Maintainer",
  promoter: "Promoter",
};

const roleTag: Record<string, "purple" | "blue" | "cool-gray"> = {
  admin: "purple",
  maintainer: "blue",
  promoter: "cool-gray",
};

interface UserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  centralServicesRole: "admin" | "maintainer" | "promoter" | null;
  passwordSet: boolean;
  lastLoginAt: string | null;
}

interface UsersTableProps {
  users: UserRow[];
  isAdmin: boolean;
  currentUserId: string;
  totalItems: number;
  page: number;
  pageSize: number;
}

export function UsersTable({
  users,
  isAdmin,
  currentUserId,
  totalItems,
  page,
  pageSize,
}: UsersTableProps) {
  return (
    <TableContainer
      title={`Utilizadores (${totalItems})`}
      className="border border-neutral-200 bg-white"
    >
      <TableFilterToolbar searchPlaceholder="Pesquisar por email ou nome">
        <FilterSelect
          paramKey="role"
          label="Papel"
          options={[
            { value: "admin", label: "Admin" },
            { value: "maintainer", label: "Maintainer" },
            { value: "promoter", label: "Promoter" },
          ]}
        />
      </TableFilterToolbar>
      <Table>
        <TableHead>
          <TableRow>
            <SortHeader sortKey="email">Email</SortHeader>
            <SortHeader sortKey="role">Papel</SortHeader>
            <TableHeader>Estado</TableHeader>
            <SortHeader sortKey="lastLoginAt" defaultDir="desc">
              Último login
            </SortHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-neutral-600">
                Sem utilizadores para o filtro actual.
              </TableCell>
            </TableRow>
          )}
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.email}</div>
                  {(u.firstName || u.lastName) && (
                    <div className="text-xs text-neutral-600">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ")}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <RoleEditor id={u.id} currentRole={u.centralServicesRole ?? "maintainer"} />
                  ) : (
                    <Tag type={roleTag[u.centralServicesRole ?? ""] ?? "cool-gray"}>
                      {roleLabel[u.centralServicesRole ?? ""] ?? u.centralServicesRole ?? "—"}
                    </Tag>
                  )}
                </TableCell>
                <TableCell>
                  {u.passwordSet ? (
                    <Tag type="green">Activo</Tag>
                  ) : (
                    <Tag type="warm-gray">A definir palavra-passe</Tag>
                  )}
                </TableCell>
                <TableCell className="text-neutral-600">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-PT") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && !isSelf && <DeleteButton id={u.id} />}
                  {isSelf && <span className="text-xs text-neutral-500">(você)</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <TablePagination totalItems={totalItems} page={page} pageSize={pageSize} />
    </TableContainer>
  );
}

// One useActionState instance per row so errors stay local to the form
// that caused them (last_admin, network_error, etc). Initial state has
// ok=null so no banner shows before the first submit.
function RoleEditor({ id, currentRole }: { id: string; currentRole: string }) {
  const [state, formAction, isPending] = useActionState(
    updateCsUserRoleAction,
    initialCsUserActionState,
  );
  return (
    <form action={formAction}>
      <div className="inline-flex items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <Select
          id={`role-${id}`}
          name="role"
          labelText=""
          hideLabel
          size="sm"
          defaultValue={currentRole}
        >
          <SelectItem value="admin" text="Admin" />
          <SelectItem value="maintainer" text="Maintainer" />
          <SelectItem value="promoter" text="Promoter" />
        </Select>
        <Button type="submit" kind="tertiary" size="sm" disabled={isPending}>
          {isPending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
      <FormFeedback state={state} successCopy="Guardado." />
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(
    deleteCsUserAction,
    initialCsUserActionState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        kind="danger--ghost"
        size="sm"
        renderIcon={TrashCan}
        disabled={isPending}
      >
        {isPending ? "A remover…" : "Remover"}
      </Button>
      <FormFeedback state={state} successCopy="Removido." />
    </form>
  );
}

function FormFeedback({
  state,
  successCopy,
}: {
  state: CsUserActionState;
  successCopy: string;
}) {
  if (state.ok === null) return null;
  if (state.ok === false) {
    return (
      <p className="mt-1 text-xs text-[var(--cds-text-error)]" role="alert">
        {state.error}
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-[var(--cds-support-success)]" role="status">
      {successCopy}
    </p>
  );
}
