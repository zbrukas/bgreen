"use client";

import { View } from "@carbon/icons-react";
import { Button } from "@carbon/react";
import type { FormSchema } from "@bgreen/types";
import { useState } from "react";
import {
  type PreviewSubTemplate,
  TemplatePreview,
} from "../_components/TemplatePreview/TemplatePreview";

interface PreviewTemplateButtonProps {
  templateName: string;
  formSchema: FormSchema;
  subTemplates: PreviewSubTemplate[];
}

export function PreviewTemplateButton({
  templateName,
  formSchema,
  subTemplates,
}: PreviewTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        kind="tertiary"
        size="sm"
        renderIcon={View}
        onClick={() => setOpen(true)}
      >
        Pré-visualizar
      </Button>
      <TemplatePreview
        open={open}
        onClose={() => setOpen(false)}
        templateName={templateName}
        formSchema={formSchema}
        subTemplates={subTemplates}
      />
    </>
  );
}
