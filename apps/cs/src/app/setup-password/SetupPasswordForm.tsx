"use client";

import { setupPasswordAction } from "@/app/actions";
import { Checkmark } from "@carbon/icons-react";
import {
  Button,
  InlineNotification,
  PasswordInput,
  Stack,
  TextInput,
} from "@carbon/react";
import { useActionState } from "react";

const initialState = { error: null };

export function SetupPasswordForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, isPending] = useActionState(setupPasswordAction, initialState);

  return (
    <form action={formAction}>
      <Stack gap={5}>
        <TextInput
          id="email"
          name="email"
          type="email"
          labelText="Email"
          required
          defaultValue={defaultEmail}
        />
        <PasswordInput
          id="newPassword"
          name="newPassword"
          labelText="Palavra-passe nova"
          helperText="Mínimo 12 caracteres."
          minLength={12}
          required
        />
        <PasswordInput
          id="confirm"
          name="confirm"
          labelText="Confirmar"
          minLength={12}
          required
        />
        {state.error && (
          <InlineNotification
            kind="error"
            title="Falha ao definir"
            subtitle={state.error}
            lowContrast
            hideCloseButton
          />
        )}
        <Button type="submit" kind="primary" disabled={isPending} renderIcon={Checkmark}>
          {isPending ? "A definir…" : "Definir palavra-passe"}
        </Button>
      </Stack>
    </form>
  );
}
