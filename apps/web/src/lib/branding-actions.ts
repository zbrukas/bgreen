"use server";

// V11.4 — server actions for the org branding settings screen.
//
// The upload is a two-step S3 presign + direct PUT flow:
//   1. getLogoUploadUrl() returns { uploadUrl, logoKey }.
//   2. The browser PUTs the file directly to S3 via uploadUrl.
//   3. updateBranding({ logoUrl: logoKey }) saves the key.
//
// Keeping the bytes off apps/api avoids buffering big logos in
// Node memory + keeps the request short.

import { withAuth } from "@workos-inc/authkit-nextjs";
import { getActiveOrgId } from "./active-org";
import { BrandingError } from "./branding-types";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

async function authedHeaders(): Promise<Record<string, string>> {
  const auth = await withAuth();
  if (!auth.user || !auth.accessToken) {
    throw new BrandingError("not_signed_in", 401);
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
  };
  const orgId = await getActiveOrgId();
  if (orgId) headers["X-Organization-Id"] = orgId;
  return headers;
}

async function readErrorCode(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "request_failed";
}

export interface LogoUploadResponse {
  uploadUrl: string;
  logoKey: string;
}

export async function getLogoUploadUrl(input: {
  organizationId: string;
  extension: "png" | "svg" | "jpg" | "jpeg" | "webp";
}): Promise<LogoUploadResponse> {
  const headers = await authedHeaders();
  const res = await fetch(
    `${API_URL}/organizations/${encodeURIComponent(input.organizationId)}/branding/logo-upload-url`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ extension: input.extension }),
    },
  );
  if (!res.ok) throw new BrandingError(await readErrorCode(res), res.status);
  return (await res.json()) as LogoUploadResponse;
}

export interface UpdateBrandingInput {
  organizationId: string;
  // Pass null to clear, undefined to leave alone.
  logoUrl?: string | null;
  brandPrimaryColor?: string | null;
}

export async function updateBranding(input: UpdateBrandingInput): Promise<void> {
  const headers = await authedHeaders();
  const body: Record<string, unknown> = {};
  if (input.logoUrl !== undefined) body.logoUrl = input.logoUrl;
  if (input.brandPrimaryColor !== undefined) {
    body.brandPrimaryColor = input.brandPrimaryColor;
  }
  const res = await fetch(
    `${API_URL}/organizations/${encodeURIComponent(input.organizationId)}/branding`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new BrandingError(await readErrorCode(res), res.status);
}
