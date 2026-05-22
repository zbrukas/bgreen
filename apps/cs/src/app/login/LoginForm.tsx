"use client";

import { signInAction } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

const initialState = { error: null, redirectToSetupForEmail: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.redirectToSetupForEmail) {
      const url = `/setup-password?email=${encodeURIComponent(state.redirectToSetupForEmail)}`;
      router.replace(url);
    }
  }, [state.redirectToSetupForEmail, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Palavra-passe</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "A entrar…" : "Entrar"}
      </Button>
    </form>
  );
}
