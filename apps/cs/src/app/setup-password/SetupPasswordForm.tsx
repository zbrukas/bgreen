"use client";

import { setupPasswordAction } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initialState = { error: null };

export function SetupPasswordForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, isPending] = useActionState(setupPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required defaultValue={defaultEmail} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Palavra-passe nova</Label>
        <Input id="newPassword" name="newPassword" type="password" minLength={12} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmar</Label>
        <Input id="confirm" name="confirm" type="password" minLength={12} required />
      </div>
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "A definir…" : "Definir palavra-passe"}
      </Button>
    </form>
  );
}
