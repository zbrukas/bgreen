"use client";

import { signInAction } from "@/app/actions";
import { ArrowRight } from "@carbon/icons-react";
import {
  Button,
  InlineNotification,
  PasswordInput,
  Stack,
  TextInput,
} from "@carbon/react";
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
    <form action={formAction}>
      <Stack gap={5}>
        <TextInput
          id="email"
          name="email"
          type="email"
          labelText="Email"
          required
          autoFocus
        />
        <PasswordInput id="password" name="password" labelText="Palavra-passe" required />
        {state.error && (
          <InlineNotification
            kind="error"
            title="Falha na autenticação"
            subtitle={state.error}
            lowContrast
            hideCloseButton
          />
        )}
        <Button type="submit" kind="primary" disabled={isPending} renderIcon={ArrowRight}>
          {isPending ? "A entrar…" : "Entrar"}
        </Button>
      </Stack>
    </form>
  );
}
