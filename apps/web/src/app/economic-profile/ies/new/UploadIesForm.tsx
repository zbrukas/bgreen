"use client";

// Two-step IES upload form:
//   1) Consent — user must check the AI-processing + deletion checkbox.
//   2) Upload — drag-drop or file picker; submits via react-query useMutation
//      → server action → apps/api /economic-profile/ies. On success we
//      redirect to the status page that polls the extraction pipeline.
//
// No dialog primitive in the shadcn set yet — consent lives inline as
// the first step of the page. Replacing it with a modal later is a
// pure component swap.

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadIes } from "@/lib/economic-profile-actions";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Mirrors the apps/api cap so we can refuse before sending.
const MAX_BYTES = 25 * 1024 * 1024;

// pt-PT error copy keyed by the server-action error message (which
// matches the apps/api error envelope). Unknown codes fall through to
// the generic message.
const ERROR_COPY: Record<string, string> = {
  file_required: "Selecione um ficheiro PDF.",
  empty_file: "O ficheiro está vazio.",
  too_large: "O ficheiro excede o limite de 25 MB.",
  not_pdf: "Apenas são aceites ficheiros PDF.",
  not_signed_in: "Sessão expirada — inicie sessão de novo.",
  forbidden: "Não tem permissões para carregar IES nesta organização.",
  no_active_org: "Selecione uma organização antes de continuar.",
};

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "request_failed";
  return ERROR_COPY[code] ?? "Não foi possível carregar o documento. Tente novamente.";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadIesForm() {
  const router = useRouter();
  const [consented, setConsented] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return uploadIes(fd);
    },
    onSuccess: (log) => {
      router.push(`/economic-profile/ies/${log.id}`);
    },
  });

  function acceptFile(candidate: File): void {
    setClientError(null);
    if (candidate.type && candidate.type !== "application/pdf") {
      setClientError(ERROR_COPY.not_pdf ?? "PDF only");
      return;
    }
    if (candidate.size === 0) {
      setClientError(ERROR_COPY.empty_file ?? "Empty file");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setClientError(ERROR_COPY.too_large ?? "Too large");
      return;
    }
    setFile(candidate);
  }

  if (!consented) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Antes de carregar</CardTitle>
          <CardDescription>
            O bGreen usa Inteligência Artificial para extrair os dados económicos do seu IES.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>O documento é processado por IA (Anthropic, na União Europeia).</li>
            <li>Após a extração e confirmação, o ficheiro PDF é eliminado dos nossos servidores.</li>
            <li>Os dados extraídos ficam guardados no seu perfil económico para análise futura.</li>
            <li>Pode sempre optar pela <strong>entrada manual</strong> em alternativa.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setConsented(true)}>Autorizo e quero continuar</Button>
            <Link
              href="/economic-profile/manual"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline self-center"
            >
              Prefiro entrada manual
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carregar IES</CardTitle>
        <CardDescription>
          Arraste o PDF aqui, ou clique para escolher. Máximo 25 MB; apenas formato PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label
          htmlFor="ies-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) acceptFile(dropped);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-10 text-center text-sm transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-muted-foreground/50"
          }`}
        >
          <span className="text-base font-medium">
            {file ? file.name : "Arraste o IES aqui ou clique para escolher"}
          </span>
          {file ? (
            <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">PDF, até 25 MB</span>
          )}
          <input
            id="ies-file"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) acceptFile(chosen);
            }}
          />
        </label>

        {clientError ? <Alert variant="destructive">{clientError}</Alert> : null}
        {mutation.isError ? (
          <Alert variant="destructive">{errorMessage(mutation.error)}</Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => file && mutation.mutate(file)}
            disabled={!file || mutation.isPending}
          >
            {mutation.isPending ? "A carregar…" : "Carregar e extrair"}
          </Button>
          {file ? (
            <Button
              variant="ghost"
              onClick={() => {
                setFile(null);
                setClientError(null);
              }}
              disabled={mutation.isPending}
            >
              Escolher outro
            </Button>
          ) : null}
          <Link
            href="/economic-profile/manual"
            className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Entrada manual
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
