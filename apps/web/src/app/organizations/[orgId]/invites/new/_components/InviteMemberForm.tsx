"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Topic } from "@bgreen/types";
import { useActionState } from "react";
import { type CreateInviteFormState, createInviteAction } from "@/app/actions";

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
      <form action={formAction} className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Convidar membro</h2>
          <p className="text-sm text-muted-foreground">
            O convidado tem de iniciar sessão com este email para aceitar.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Papel</Label>
          <Select id="invite-role" name="role" defaultValue="org_user_write">
            <option value="org_user_write">Membro</option>
            <option value="org_admin">Administrador</option>
          </Select>
        </div>

        {topics.length > 0 && (
          <fieldset className="space-y-1.5 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Âmbito de tópicos</legend>
            <p className="text-xs text-muted-foreground">
              Deixe sem seleção para visibilidade total. Marque tópicos para restringir o que o
              membro consegue ver e editar.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {topics.map((t) => (
                <label key={t.id} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="topicScope"
                    value={t.slug}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                  />
                  <span>
                    {t.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">({t.slug})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {state.error && <Alert variant="destructive">{state.error}</Alert>}

        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? "A criar…" : "Criar convite"}
        </Button>
      </form>

      {state.acceptUrl && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">Convite criado para {state.invitedEmail}.</p>

            {state.emailDelivered === true && (
              <Alert variant="success">
                <AlertDescription>✓ Email enviado.</AlertDescription>
              </Alert>
            )}
            {state.emailDelivered === false && (
              <Alert variant="warning">
                <AlertTitle>Email não foi enviado</AlertTitle>
                <AlertDescription>
                  {state.emailReason ? `(${state.emailReason}). ` : ""}Partilhe o link manualmente.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Link (validade: 7 dias)</Label>
              <Input
                readOnly
                value={state.acceptUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
