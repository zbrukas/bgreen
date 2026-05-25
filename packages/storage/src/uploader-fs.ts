// FsUploader — local-filesystem implementation of S3Uploader.
//
// Mirrors the legacy bgreen storage strategy: files live on disk under
// rootDir, partitioned by the caller-owned key (e.g.
// `organizations/{orgId}/ies/2025-01-15.pdf`). Used when STORAGE_DRIVER=fs.
//
// Limitations vs. AwsS3Uploader:
//   - presignedUploadUrl returns an error. PUT-via-URL has no filesystem
//     equivalent; callers must upload through an API route that calls
//     `upload()` server-side.
//   - presignedDownloadUrl returns an HMAC-signed URL pointing at an API
//     route (see signed-url.ts). The route verifies the signature and
//     streams the file. Same TTL semantics as S3.
//   - `download()` buffers the whole file in memory. Fine for the current
//     callers (IES PDFs ≤25 MB, reports ≤a few MB). Add a streaming
//     variant if/when a larger-file caller appears.

import { promises as fs } from "node:fs";
import path from "node:path";
import { storageError, type StorageError } from "./errors";
import { type Result, err, ok } from "./result";
import { signDownloadUrl } from "./signed-url";
import type {
  DownloadResult,
  PresignOptions,
  S3Uploader,
  UploadInput,
} from "./uploader";

export interface FsUploaderConfig {
  // Absolute path to the storage root. Files are written under
  // `${rootDir}/${key}`. Parent directories are created on demand.
  rootDir: string;
  // HMAC secret used to sign download URLs. Required even though no
  // upload is signed today — keeps the contract uniform if we ever need
  // signed upload tokens for direct-to-disk POSTs.
  signingSecret: string;
  // Optional URL prefix prepended to signed URLs. Omit to emit path-only
  // URLs (e.g. `/api/storage/download/...`) which the client resolves
  // against the API base.
  publicBaseUrl?: string;
  // Mount path of the download route in apps/api. Defaults to
  // `/api/storage/download`. Override only if the route is remounted.
  downloadRoutePath?: string;
}

const DEFAULT_DOWNLOAD_ROUTE = "/api/storage/download";

export class FsUploader implements S3Uploader {
  private readonly rootDir: string;
  private readonly signingSecret: string;
  private readonly publicBaseUrl: string;
  private readonly downloadRoutePath: string;

  constructor(config: FsUploaderConfig) {
    this.rootDir = path.resolve(config.rootDir);
    this.signingSecret = config.signingSecret;
    this.publicBaseUrl = (config.publicBaseUrl ?? "").replace(/\/$/, "");
    this.downloadRoutePath = (config.downloadRoutePath ?? DEFAULT_DOWNLOAD_ROUTE).replace(
      /\/$/,
      "",
    );
  }

  async upload(input: UploadInput): Promise<Result<void, StorageError>> {
    if (input.maxSizeBytes !== undefined) {
      const size = sizeOf(input.body);
      if (size > input.maxSizeBytes) {
        return err(
          storageError(
            "invalid_request",
            `object size ${size} exceeds caller-provided max ${input.maxSizeBytes}`,
          ),
        );
      }
    }
    const resolved = this.resolveSafe(input.key);
    if (!resolved.ok) return err(resolved.error);

    try {
      await fs.mkdir(path.dirname(resolved.value), { recursive: true });
      await fs.writeFile(resolved.value, toBufferOrUint8(input.body));
      return ok(undefined);
    } catch (e) {
      return err(mapNodeError(e));
    }
  }

  async download(key: string): Promise<Result<DownloadResult, StorageError>> {
    const resolved = this.resolveSafe(key);
    if (!resolved.ok) return err(resolved.error);
    try {
      const body = await fs.readFile(resolved.value);
      return ok({
        body: new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
        // No content-type stored on disk; callers that need it either
        // pass it through their own metadata or sniff on download.
        contentType: undefined,
        contentLength: body.byteLength,
      });
    } catch (e) {
      return err(mapNodeError(e));
    }
  }

  presignedUploadUrl(
    _key: string,
    _options?: PresignOptions,
  ): Promise<Result<string, StorageError>> {
    // No filesystem equivalent of PUT-via-URL. Callers that need direct
    // uploads should switch to the S3 driver or POST through an API route.
    return Promise.resolve(
      err(
        storageError(
          "invalid_request",
          "fs backend does not support presigned upload URLs — POST through an API route instead",
        ),
      ),
    );
  }

  presignedDownloadUrl(
    key: string,
    options: PresignOptions = {},
  ): Promise<Result<string, StorageError>> {
    // Even though we don't need the path on disk for signing, validate
    // the key shape so a caller can't request a signed URL for a key
    // that would later fail at the route.
    const resolved = this.resolveSafe(key);
    if (!resolved.ok) return Promise.resolve(err(resolved.error));

    const ttl = options.expiresInSeconds ?? 900;
    const { exp, sig } = signDownloadUrl(this.signingSecret, key, ttl);
    const url = `${this.publicBaseUrl}${this.downloadRoutePath}/${encodeKey(key)}?exp=${exp}&sig=${sig}`;
    return Promise.resolve(ok(url));
  }

  async delete(key: string): Promise<Result<void, StorageError>> {
    const resolved = this.resolveSafe(key);
    if (!resolved.ok) return err(resolved.error);
    try {
      await fs.unlink(resolved.value);
      return ok(undefined);
    } catch (e) {
      // Match S3 idempotency: deleting a missing key is not an error.
      if (isNodeErrorWithCode(e, "ENOENT")) return ok(undefined);
      return err(mapNodeError(e));
    }
  }

  // For the download route: resolve a key into an absolute filesystem
  // path, returning an error if the key would escape rootDir. Exposed so
  // the route can stream the file directly without going through
  // download() (which buffers).
  resolveKey(key: string): Result<string, StorageError> {
    return this.resolveSafe(key);
  }

  private resolveSafe(key: string): Result<string, StorageError> {
    if (typeof key !== "string" || key.length === 0) {
      return err(storageError("invalid_request", "empty key"));
    }
    if (key.includes("\0")) {
      return err(storageError("invalid_request", "key contains null byte"));
    }
    if (path.isAbsolute(key)) {
      return err(storageError("invalid_request", "absolute key not allowed"));
    }
    const target = path.resolve(this.rootDir, key);
    if (target !== this.rootDir && !target.startsWith(this.rootDir + path.sep)) {
      return err(storageError("invalid_request", "key escapes storage root"));
    }
    return ok(target);
  }
}

function encodeKey(key: string): string {
  // Preserve forward slashes so the route's wildcard segment sees the
  // partition structure; encode every other byte that needs it.
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sizeOf(body: UploadInput["body"]): number {
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  return body.byteLength;
}

function toBufferOrUint8(body: UploadInput["body"]): Buffer | Uint8Array {
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (body instanceof Uint8Array) return body;
  return Buffer.from(body);
}

function isNodeErrorWithCode(e: unknown, code: string): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === code;
}

function mapNodeError(e: unknown): StorageError {
  if (typeof e !== "object" || e === null) {
    return storageError("unknown", e instanceof Error ? e.message : String(e), e);
  }
  const code = (e as { code?: string }).code;
  const message = (e as { message?: string }).message ?? "filesystem error";
  switch (code) {
    case "ENOENT":
      return storageError("not_found", message, e);
    case "EACCES":
    case "EPERM":
      return storageError("bucket_unavailable", message, e);
    case "EISDIR":
    case "ENOTDIR":
      return storageError("invalid_request", message, e);
    case "ENOSPC":
    case "EBUSY":
      return storageError("transient", message, e);
    default:
      return storageError("unknown", message, e);
  }
}
