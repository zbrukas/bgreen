"use client";

import { type CreateInviteFormState, createInviteAction } from "@/app/actions";
import { Add } from "@carbon/icons-react";
import {
  Button,
  Checkbox,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  TextInput,
  Tile,
} from "@carbon/react";
import type { Topic } from "@bgreen/types";
import { useActionState } from "react";

const initialState: CreateInviteFormState = {
  error: null,
  acceptUrl: null,
  invitedEmail: null,
  emailDelivered: null,
  emailReason: null,
};

interface InviteMemberFormProps {
  organizationId: string;
  topics: Topic[];
}

export function InviteMemberForm({ organizationId, topics }: InviteMemberFormProps) {
  const actionWithOrg = createInviteAction.bind(null, organizationId);
  const [state, formAction, isPending] = useActionState(actionWithOrg, initialState);

  return (
    <div className="max-w-lg space-y-6">
      <form action={formAction}>
        <Stack gap={5}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 500, margin: 0 }}>Convidar membro</h2>
            <p className="mt-1 text-sm text-neutral-700">
              O convidado tem de iniciar sessão com este email para aceitar.
            </p>
          </div>

          <TextInput
            id="invite-email"
            name="email"
            labelText="Email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
          />

          <Select id="invite-role" name="role" labelText="Papel" defaultValue="org_user_write">
            <SelectItem value="org_user_write" text="Membro" />
            <SelectItem value="org_admin" text="Administrador" />
          </Select>

          {topics.length > 0 && (
            <fieldset className="rounded-md border border-neutral-200 p-3">
              <legend className="px-1 text-sm font-medium">Âmbito de tópicos</legend>
              <p className="mb-2 text-xs text-neutral-600">
                Deixe sem seleção para visibilidade total. Marque tópicos para restringir o que o
                membro consegue ver e editar.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {topics.map((t) => (
                  <Checkbox
                    key={t.id}
                    id={`topic-${t.slug}`}
                    name="topicScope"
                    value={t.slug}
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
            </fieldset>
          )}

          {state.error && (
            <InlineNotification
              kind="error"
              title="Não foi possível criar o convite"
              subtitle={state.error}
              lowContrast
              hideCloseButton
            />
          )}

          <Button type="submit" kind="primary" size="lg" disabled={isPending} renderIcon={Add}>
            {isPending ? "A criar…" : "Criar convite"}
          </Button>
        </Stack>
      </form>

      {state.acceptUrl && (
        <Tile>
          <p className="font-medium">Convite criado para {state.invitedEmail}.</p>

          {state.emailDelivered === true && (
            <div className="mt-3">
              <InlineNotification
                kind="success"
                title="Email enviado"
                lowContrast
                hideCloseButton
              />
            </div>
          )}
          {state.emailDelivered === false && (
            <div className="mt-3">
              <InlineNotification
                kind="warning"
                title="Email não foi enviado"
                subtitle={`${state.emailReason ? `(${state.emailReason}). ` : ""}Partilhe o link manualmente.`}
                lowContrast
                hideCloseButton
              />
            </div>
          )}

          <div className="mt-3">
            <TextInput
              id="invite-accept-url"
              labelText="Link (validade: 7 dias)"
              readOnly
              value={state.acceptUrl}
              onFocus={(e) => e.currentTarget.select()}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            />
          </div>
        </Tile>
      )}
    </div>
  );
}
