"use client";

import { deleteCsUserAction, updateCsUserRoleAction } from "@/app/actions";
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

export function UsersTable({
  users,
  isAdmin,
  currentUserId,
}: {
  users: UserRow[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  if (users.length === 0) {
    return <p className="text-sm text-neutral-600">Sem utilizadores CS registados.</p>;
  }
  return (
    <TableContainer title={`Utilizadores (${users.length})`}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Email</TableHeader>
            <TableHeader>Papel</TableHeader>
            <TableHeader>Estado</TableHeader>
            <TableHeader>Último login</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
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
                    <form action={updateCsUserRoleAction} className="inline-flex items-end gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <Select
                        id={`role-${u.id}`}
                        name="role"
                        labelText=""
                        hideLabel
                        size="sm"
                        defaultValue={u.centralServicesRole ?? "maintainer"}
                      >
                        <SelectItem value="admin" text="Admin" />
                        <SelectItem value="maintainer" text="Maintainer" />
                        <SelectItem value="promoter" text="Promoter" />
                      </Select>
                      <Button type="submit" kind="tertiary" size="sm">
                        Guardar
                      </Button>
                    </form>
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
                  {isAdmin && !isSelf && (
                    <form action={deleteCsUserAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <Button type="submit" kind="ghost" size="sm" renderIcon={TrashCan}>
                        Remover
                      </Button>
                    </form>
                  )}
                  {isSelf && <span className="text-xs text-neutral-500">(você)</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
