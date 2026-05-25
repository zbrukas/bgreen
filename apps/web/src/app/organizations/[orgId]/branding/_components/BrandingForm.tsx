"use client";

// V11.4 — org branding settings. Two controls:
//   1. Logo upload (PNG / SVG / JPG / WEBP). Two-step S3 presign:
//      POST .../branding/logo-upload-url → PUT to S3 → PATCH branding
//      with the returned key.
//   2. Brand primary color (#rrggbb). Inline color input + preview.

import { getLogoUploadUrl, updateBranding } from "@/lib/branding-actions";
import { Save, TrashCan, Upload } from "@carbon/icons-react";
import { Button, InlineNotification, TextInput, Tile } from "@carbon/react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

interface BrandingFormProps {
  organizationId: string;
  initialLogoKey: string | null;
  initialPrimaryColor: string | null;
}

const ALLOWED_EXTENSIONS = ["png", "svg", "jpg", "jpeg", "webp"] as const;
type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

const DEFAULT_COLOR = "#0f6f3e";

function pickExtension(filename: string): AllowedExtension | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext as AllowedExtension)
    : null;
}

function contentTypeFor(ext: AllowedExtension): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
  }
}

export function BrandingForm({
  organizationId,
  initialLogoKey,
  initialPrimaryColor,
}: BrandingFormProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [logoKey, setLogoKey] = useState<string | null>(initialLogoKey);
  const [color, setColor] = useState<string>(initialPrimaryColor ?? DEFAULT_COLOR);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const colorValid = useMemo(
    () => /^#[0-9a-fA-F]{6}$/.test(color),
    [color],
  );

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const ext = pickExtension(file.name);
      if (!ext) throw new Error("unsupported_file_type");
      const { uploadUrl, logoKey: nextKey } = await getLogoUploadUrl({
        organizationId,
        extension: ext,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentTypeFor(ext) },
        body: file,
      });
      if (!put.ok) throw new Error("upload_failed");
      await updateBranding({ organizationId, logoUrl: nextKey });
      return nextKey;
    },
    onSuccess: (nextKey) => {
      setLogoKey(nextKey);
      setErrorMessage(null);
      router.refresh();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "upload_failed";
      setErrorMessage(
        msg === "unsupported_file_type"
          ? "Formato não suportado. Use PNG, SVG, JPG ou WEBP."
          : "Não foi possível carregar o logótipo. Tente novamente.",
      );
    },
  });

  const removeLogo = useMutation({
    mutationFn: () => updateBranding({ organizationId, logoUrl: null }),
    onSuccess: () => {
      setLogoKey(null);
      setErrorMessage(null);
      router.refresh();
    },
    onError: () => {
      setErrorMessage("Não foi possível remover o logótipo. Tente novamente.");
    },
  });

  const saveColor = useMutation({
    mutationFn: () =>
      updateBranding({
        organizationId,
        brandPrimaryColor: colorValid ? color : null,
      }),
    onSuccess: () => {
      setErrorMessage(null);
      router.refresh();
    },
    onError: () => {
      setErrorMessage("Não foi possível guardar a cor. Tente novamente.");
    },
  });

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <InlineNotification
          kind="error"
          title="Erro"
          subtitle={errorMessage}
          lowContrast
          hideCloseButton
        />
      ) : null}

      <Tile>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
          Logótipo
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Aparece na capa e nos cabeçalhos dos relatórios PDF. Formatos: PNG, SVG, JPG, WEBP.
        </p>
        <div className="mt-4 space-y-3">
          {logoKey ? (
            <p className="text-xs text-neutral-600">
              Logótipo atual:{" "}
              <code style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{logoKey}</code>
            </p>
          ) : (
            <p className="text-xs text-neutral-600">Sem logótipo carregado.</p>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".png,.svg,.jpg,.jpeg,.webp,image/png,image/svg+xml,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadLogo.mutate(file);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              kind="tertiary"
              size="sm"
              onClick={() => fileInput.current?.click()}
              disabled={uploadLogo.isPending}
              renderIcon={Upload}
            >
              {uploadLogo.isPending
                ? "A carregar…"
                : logoKey
                  ? "Substituir logótipo"
                  : "Carregar logótipo"}
            </Button>
            {logoKey ? (
              <Button
                type="button"
                kind="ghost"
                size="sm"
                onClick={() => removeLogo.mutate()}
                disabled={removeLogo.isPending}
                renderIcon={TrashCan}
              >
                {removeLogo.isPending ? "A remover…" : "Remover"}
              </Button>
            ) : null}
          </div>
        </div>
      </Tile>

      <Tile>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
          Cor primária
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Usada em títulos e bordas de destaque dos relatórios.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-end gap-3">
            <input
              type="color"
              value={colorValid ? color : DEFAULT_COLOR}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded border border-neutral-300"
              aria-label="Selector de cor"
            />
            <div className="w-32">
              <TextInput
                id="brand-color-hex"
                labelText="Cor (hex)"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#0f6f3e"
                maxLength={7}
                invalid={!colorValid}
                invalidText={!colorValid ? "Use o formato #rrggbb." : undefined}
                style={{ fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}
              />
            </div>
            <span
              className="inline-block h-10 w-16 rounded border border-neutral-300"
              style={{ background: colorValid ? color : DEFAULT_COLOR }}
              aria-hidden
            />
          </div>
          <Button
            type="button"
            kind="primary"
            size="sm"
            onClick={() => saveColor.mutate()}
            disabled={!colorValid || saveColor.isPending}
            renderIcon={Save}
          >
            {saveColor.isPending ? "A guardar…" : "Guardar cor"}
          </Button>
        </div>
      </Tile>
    </div>
  );
}
