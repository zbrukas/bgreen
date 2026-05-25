"use client";

import { Save } from "@carbon/icons-react";
import {
  Button,
  Checkbox,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
} from "@carbon/react";
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
    <form action={formAction}>
      <Stack gap={5}>
        <Select
          id="role"
          name="role"
          labelText="Papel"
          defaultValue={currentRole}
          helperText={
            isSelf
              ? "Não pode rebaixar-se a si próprio — apenas outro administrador o pode fazer."
              : undefined
          }
        >
          <SelectItem value="org_admin" text="Administrador" />
          <SelectItem value="org_user_write" text="Membro" />
          <SelectItem value="org_user_read" text="Leitor" />
        </Select>

        <fieldset className="rounded-md border border-neutral-200 p-3">
          <legend className="px-1 text-sm font-medium">Âmbito de tópicos</legend>
          <p className="mb-2 text-xs text-neutral-600">
            Sem seleção = visibilidade total. Marque tópicos para restringir o que o membro vê e
            edita nos sub-modelos.
          </p>
          {topics.length === 0 ? (
            <p className="text-xs text-neutral-600">
              Sem tópicos no catálogo. Pergunte aos serviços centrais.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {topics.map((t) => (
                <Checkbox
                  key={t.id}
                  id={`scope-${t.slug}`}
                  name="topicScope"
                  value={t.slug}
                  defaultChecked={selected.has(t.slug)}
                  labelText={
                    <span>
                      {t.name}{" "}
                      <span
                        className="text-xs text-neutral-600"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        ({t.slug})
                      </span>
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </fieldset>

        {state.error && (
          <InlineNotification
            kind="error"
            title="Erro"
            subtitle={state.error}
            lowContrast
            hideCloseButton
          />
        )}
        {state.saved && (
          <InlineNotification kind="success" title="Atualizado" lowContrast hideCloseButton />
        )}

        <Button type="submit" kind="primary" disabled={isPending} renderIcon={Save}>
          {isPending ? "A guardar…" : "Guardar"}
        </Button>
      </Stack>
    </form>
  );
}
