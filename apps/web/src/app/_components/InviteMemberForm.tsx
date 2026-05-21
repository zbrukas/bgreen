"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useActionState } from "react";
import { type CreateInviteFormState, createInviteAction } from "../actions";

const initialState: CreateInviteFormState = {
  error: null,
  acceptUrl: null,
  invitedEmail: null,
  emailDelivered: null,
  emailReason: null,
};

interface InviteMemberFormProps {
  organizationId: string;
}

export function InviteMemberForm({ organizationId }: InviteMemberFormProps) {
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
          <Select id="invite-role" name="role" defaultValue="member">
            <option value="member">Membro</option>
            <option value="admin">Administrador</option>
          </Select>
        </div>

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
