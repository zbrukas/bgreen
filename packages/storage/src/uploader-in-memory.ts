// In-memory S3Uploader. Same interface, no AWS dependency at runtime.
// Used in unit tests; also a valid dev fallback when MinIO isn't up.

import type { StorageError } from "./errors";
import { type Result, err, ok } from "./result";
import type {
  DownloadResult,
  PresignOptions,
  S3Uploader,
  UploadInput,
} from "./uploader";

interface StoredObject {
  body: Uint8Array;
  contentType?: string;
}

export class InMemoryS3Uploader implements S3Uploader {
  private readonly objects = new Map<string, StoredObject>();

  // For tests — peek at what's been stored without going through the
  // download path (which exercises error mapping we may not want to test).
  has(key: string): boolean {
    return this.objects.has(key);
  }

  size(): number {
    return this.objects.size;
  }

  upload(input: UploadInput): Promise<Result<void, StorageError>> {
    if (input.maxSizeBytes !== undefined) {
      const size = sizeOf(input.body);
      if (size > input.maxSizeBytes) {
        return Promise.resolve(
          err<StorageError>({
            kind: "invalid_request",
            message: `object size ${size} exceeds caller-provided max ${input.maxSizeBytes}`,
          }),
        );
      }
    }
    this.objects.set(input.key, {
      body: toUint8Array(input.body),
      contentType: input.contentType,
    });
    return Promise.resolve(ok(undefined));
  }

  download(key: string): Promise<Result<DownloadResult, StorageError>> {
    const obj = this.objects.get(key);
    if (!obj) {
      return Promise.resolve(
        err<StorageError>({ kind: "not_found", message: `no such key: ${key}` }),
      );
    }
    return Promise.resolve(
      ok({
        body: obj.body,
        contentType: obj.contentType,
        contentLength: obj.body.byteLength,
      }),
    );
  }

  presignedUploadUrl(
    key: string,
    _options?: PresignOptions,
  ): Promise<Result<string, StorageError>> {
    // Deterministic placeholder — callers can detect "this is a stub" in
    // tests by URL pattern.
    return Promise.resolve(ok(`https://in-memory.local/upload/${encodeURIComponent(key)}`));
  }

  presignedDownloadUrl(
    key: string,
    _options?: PresignOptions,
  ): Promise<Result<string, StorageError>> {
    return Promise.resolve(ok(`https://in-memory.local/download/${encodeURIComponent(key)}`));
  }

  delete(key: string): Promise<Result<void, StorageError>> {
    // Match S3 idempotency: deleting a missing key is not an error.
    this.objects.delete(key);
    return Promise.resolve(ok(undefined));
  }
}

function sizeOf(body: UploadInput["body"]): number {
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  return body.byteLength;
}

function toUint8Array(body: UploadInput["body"]): Uint8Array {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}
