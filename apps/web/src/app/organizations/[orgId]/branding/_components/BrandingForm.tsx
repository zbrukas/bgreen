"use client";

// V11.4 — org branding settings. Two controls:
//   1. Logo upload (PNG / SVG / JPG / WEBP). Two-step S3 presign:
//      POST .../branding/logo-upload-url → PUT to S3 → PATCH branding
//      with the returned key.
//   2. Brand primary color (#rrggbb). Inline color input + preview.
//
// On success, the page is server-refreshed so the new logoUrl /
// brandPrimaryColor surface across the app.

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLogoUploadUrl, updateBranding } from "@/lib/branding-actions";
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
      // Persist the key right after the bytes land. Two PATCHes are
      // possible here (logo first, color separately) but combining
      // them keeps the UI single-button.
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
      {errorMessage ? <Alert variant="destructive">{errorMessage}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logótipo</CardTitle>
          <CardDescription>
            Aparece na capa e nos cabeçalhos dos relatórios PDF.
            Formatos: PNG, SVG, JPG, WEBP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {logoKey ? (
            <p className="text-xs text-muted-foreground">
              Logótipo atual: <code>{logoKey}</code>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem logótipo carregado.
            </p>
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
              variant="outline"
              size="sm"
              onClick={() => fileInput.current?.click()}
              disabled={uploadLogo.isPending}
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
                variant="ghost"
                size="sm"
                onClick={() => removeLogo.mutate()}
                disabled={removeLogo.isPending}
              >
                {removeLogo.isPending ? "A remover…" : "Remover"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cor primária</CardTitle>
          <CardDescription>
            Usada em títulos e bordas de destaque dos relatórios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colorValid ? color : DEFAULT_COLOR}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input"
              aria-label="Selector de cor"
            />
            <Label htmlFor="brand-color-hex" className="sr-only">
              Cor em formato hexadecimal
            </Label>
            <Input
              id="brand-color-hex"
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#0f6f3e"
              maxLength={7}
              className="w-32 font-mono uppercase"
            />
            <span
              className="inline-block h-9 w-16 rounded border"
              style={{ background: colorValid ? color : DEFAULT_COLOR }}
              aria-hidden
            />
          </div>
          {!colorValid ? (
            <p className="text-xs text-destructive">
              Use o formato #rrggbb (ex.: #0f6f3e).
            </p>
          ) : null}
          <div>
            <Button
              type="button"
              size="sm"
              onClick={() => saveColor.mutate()}
              disabled={!colorValid || saveColor.isPending}
            >
              {saveColor.isPending ? "A guardar…" : "Guardar cor"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
