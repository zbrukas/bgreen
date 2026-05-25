// Public route that backs `FsUploader.presignedDownloadUrl()`. Only
// mounted when STORAGE_DRIVER=fs; the S3 driver issues real S3 presigned
// URLs that bypass this app entirely.
//
// Auth model matches S3 presigning: the signature *is* the
// authorization. We don't check the session — possession of a valid sig
// + non-expired exp is sufficient to read the object. Callers must
// therefore mint URLs only after their own access checks.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { type FsUploader, verifyDownloadUrl } from "@bgreen/storage";
import { Hono } from "hono";

export function createStorageDownloadRoute(
  uploader: FsUploader,
  signingSecret: string,
): Hono {
  const route = new Hono();

  // `*` captures the rest of the URL including slashes — the key may
  // contain path separators like `organizations/{orgId}/...`.
  route.get("/*", async (c) => {
    const fullPath = c.req.path;
    // Strip the route mount prefix to recover the raw key.
    const prefix = "/api/storage/download/";
    if (!fullPath.startsWith(prefix)) {
      return c.json({ error: "not_found" }, 404);
    }
    const key = decodeKey(fullPath.slice(prefix.length));

    const sig = c.req.query("sig") ?? "";
    const expStr = c.req.query("exp") ?? "";
    const exp = Number.parseInt(expStr, 10);

    const verify = verifyDownloadUrl(signingSecret, key, sig, exp);
    if (!verify.ok) {
      const status = verify.reason === "expired" ? 410 : 403;
      return c.json({ error: verify.reason }, status);
    }

    const resolved = uploader.resolveKey(key);
    if (!resolved.ok) {
      return c.json({ error: resolved.error.kind }, 400);
    }

    let size: number;
    try {
      const info = await stat(resolved.value);
      if (!info.isFile()) return c.json({ error: "not_found" }, 404);
      size = info.size;
    } catch {
      return c.json({ error: "not_found" }, 404);
    }

    // Stream from disk so 100 MB downloads don't buffer in memory. Use
    // Node→Web stream bridging because Hono expects a web ReadableStream.
    const nodeStream = createReadStream(resolved.value);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Length": String(size),
        // Generic — no MIME storage in legacy/fs model. Browser sniffs
        // for image/pdf; downloaders honor Content-Disposition.
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${basename(key)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  });

  return route;
}

function decodeKey(rawPath: string): string {
  return rawPath
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

function basename(key: string): string {
  const idx = key.lastIndexOf("/");
  return idx === -1 ? key : key.slice(idx + 1);
}
