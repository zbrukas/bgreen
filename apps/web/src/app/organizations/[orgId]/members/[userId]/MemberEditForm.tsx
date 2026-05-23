"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { MembershipRole, Topic } from "@bgreen/types";
import { useActionState } from "react";
import { type UpdateMemberFormState, updateMemberAction } from "../../../../actions";

const initial: UpdateMemberFormState = { error: null, saved: false };

interface MemberEditFormProps {
  organizationId: string;
  userId: string;
  currentRole: MembershipRole;
  currentScope: string[];
  topics: Topic[];
  isSelf: boolean;
}

export function MemberEditForm({
  organizationId,
  userId,
  currentRole,
  currentScope,
  topics,
  isSelf,
}: MemberEditFormProps) {
  const action = updateMemberAction.bind(null, organizationId, userId);
  const [state, formAction, isPending] = useActionState(action, initial);
  const selected = new Set(currentScope);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="role">Papel</Label>
        <Select id="role" name="role" defaultValue={currentRole}>
          <option value="org_admin">Administrador</option>
          <option value="org_user_write">Membro</option>
          <option value="org_user_read">Leitor</option>
        </Select>
        {isSelf && (
          <p className="text-xs text-muted-foreground">
            Não pode rebaixar-se a si próprio — apenas outro administrador o pode fazer.
          </p>
        )}
      </div>

      <fieldset className="space-y-1.5 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Âmbito de tópicos</legend>
        <p className="text-xs text-muted-foreground">
          Sem seleção = visibilidade total. Marque tópicos para restringir o que o membro vê e edita
          nos sub-modelos.
        </p>
        {topics.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem tópicos no catálogo. Pergunte aos serviços centrais.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {topics.map((t) => (
              <label key={t.id} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="topicScope"
                  value={t.slug}
                  defaultChecked={selected.has(t.slug)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                <span>
                  {t.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">({t.slug})</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.saved && <Alert variant="success">Atualizado.</Alert>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "A guardar…" : "Guardar"}
      </Button>
    </form>
  );
}
