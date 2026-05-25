"use client";

import { archiveTemplateAction, publishTemplateAction } from "@/app/actions";
import { Archive, Send } from "@carbon/icons-react";
import { Button, ButtonSet } from "@carbon/react";

interface TemplateActionsProps {
  templateId: string;
  status: "draft" | "published" | "archived" | string;
}

export function TemplateActions({ templateId, status }: TemplateActionsProps) {
  return (
    <ButtonSet>
      {status !== "archived" && (
        <form action={archiveTemplateAction}>
          <input type="hidden" name="id" value={templateId} />
          <Button type="submit" kind="tertiary" size="sm" renderIcon={Archive}>
            Arquivar
          </Button>
        </form>
      )}
      {status === "draft" && (
        <form action={publishTemplateAction}>
          <input type="hidden" name="id" value={templateId} />
          <Button type="submit" kind="primary" size="sm" renderIcon={Send}>
            Publicar
          </Button>
        </form>
      )}
    </ButtonSet>
  );
}
