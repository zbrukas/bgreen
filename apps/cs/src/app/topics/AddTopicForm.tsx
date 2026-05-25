"use client";

import { addTopicAction } from "@/app/actions";
import { Add } from "@carbon/icons-react";
import { Button, Stack, TextInput, Tile } from "@carbon/react";

export function AddTopicForm() {
  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        Adicionar tópico
      </h2>
      <form
        action={async (formData) => {
          await addTopicAction({ error: null }, formData);
        }}
        className="mt-4"
      >
        <Stack gap={5}>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <TextInput
              id="slug"
              name="slug"
              labelText="Slug"
              placeholder="hr"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              required
            />
            <TextInput
              id="name"
              name="name"
              labelText="Nome"
              placeholder="Recursos Humanos"
              required
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
