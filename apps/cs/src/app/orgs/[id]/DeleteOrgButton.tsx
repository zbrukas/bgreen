"use client";

import { TrashCan } from "@carbon/icons-react";
import {
  Button,
  Modal,
  TextInput,
} from "@carbon/react";
import { useState, useTransition } from "react";
import { deleteOrgAction } from "./actions";

interface DeleteOrgButtonProps {
  organizationId: string;
  organizationName: string;
}

export function DeleteOrgButton({ organizationId, organizationName }: DeleteOrgButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const matches = confirmation.trim() === organizationName;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteOrgAction(organizationId);
      // deleteOrgAction redirects on success, so we only see a return
      // value when it failed. Surface the error inline.
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button kind="danger--tertiary" renderIcon={TrashCan} onClick={() => setOpen(true)}>
        Eliminar organização
      </Button>
      <Modal
        open={open}
        onRequestClose={() => {
          setOpen(false);
          setConfirmation("");
          setError(null);
        }}
        onRequestSubmit={handleConfirm}
        modalHeading={`Eliminar “${organizationName}”?`}
        primaryButtonText={pending ? "A eliminar…" : "Eliminar"}
        secondaryButtonText="Cancelar"
        danger
        primaryButtonDisabled={!matches || pending}
        size="sm"
      >
        <p className="mb-4 text-sm">
          Esta ação remove a organização e <strong>todos</strong> os dados associados
          (registos, workflows, perfis económicos, relatórios) em cascata. Não é
          reversível.
        </p>
        <TextInput
          id="confirm-org-delete"
          labelText={`Para confirmar, escreva o nome da organização: ${organizationName}`}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          invalid={confirmation.length > 0 && !matches}
          invalidText="O nome não coincide."
        />
        {error && (
          <p className="mt-3 text-sm text-[--cds-text-error]">
            Erro: {error}
          </p>
        )}
      </Modal>
    </>
  );
}
