"use client";

import { addCsUserAction } from "@/app/actions";
import { Add } from "@carbon/icons-react";
import { Button, Select, SelectItem, Stack, TextInput, Tile } from "@carbon/react";

export function AddUserForm() {
  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        Adicionar utilizador
      </h2>
      <form
        action={async (formData) => {
          await addCsUserAction({ error: null }, formData);
        }}
        className="mt-4"
      >
        <Stack gap={5}>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <TextInput id="email" name="email" type="email" labelText="Email" required />
            <Select id="role" name="role" labelText="Papel" defaultValue="maintainer">
              <SelectItem value="admin" text="Admin" />
              <SelectItem value="maintainer" text="Maintainer" />
              <SelectItem value="promoter" text="Promoter" />
            </Select>
            <Button type="submit" kind="primary" renderIcon={Add}>
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-neutral-600">
            O utilizador define a palavra-passe ao iniciar sessão pela primeira vez.
          </p>
        </Stack>
      </form>
    </Tile>
  );
}
