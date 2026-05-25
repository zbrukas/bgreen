"use client";

import { addDomainAction } from "@/app/actions";
import { Add } from "@carbon/icons-react";
import { Button, Stack, TextInput, Tile } from "@carbon/react";

export function AddDomainForm() {
  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        Adicionar domínio
      </h2>
      <form
        action={async (formData) => {
          await addDomainAction({ error: null }, formData);
        }}
        className="mt-4"
      >
        <Stack gap={5}>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <TextInput
              id="domain"
              name="domain"
              labelText="Domínio"
              placeholder="nomad.consulting"
              required
            />
            <TextInput
              id="note"
              name="note"
              labelText="Nota (opcional)"
              placeholder="Consultoria parceira…"
            />
            <Button type="submit" kind="primary" renderIcon={Add}>
              Adicionar
            </Button>
          </div>
        </Stack>
      </form>
    </Tile>
  );
}
