// What can go wrong on object storage. Narrow enough that callers can
// react without reading the underlying SDK shape.

export type StorageErrorKind =
  // Object doesn't exist (404 / NoSuchKey). Distinguished from generic
  // failures so callers can choose to surface "file already deleted" vs.
  // a hard error.
  | "not_found"
  // Bucket itself is missing or inaccessible. Misconfiguration.
  | "bucket_unavailable"
  // Caller misuse — empty body, oversized object, etc. The S3 limit on
  // a single PUT is 5 GiB; we enforce stricter caller-level limits where
  // it matters (e.g., 25 MB on IES PDFs).
  | "invalid_request"
  // Network / 5xx / connection reset. Retryable at the caller's discretion.
  | "transient"
  // Anything else. Includes credentials mis-set, region mismatch, etc.
  | "unknown";

export interface StorageError {
  kind: StorageErrorKind;
  message: string;
  cause?: unknown;
}

export const storageError = (
  kind: StorageErrorKind,
  message: string,
  cause?: unknown,
): StorageError => ({ kind, message, cause });

// Map an AWS SDK exception to our error union. Lives here (not inline in
// the AWS client) so tests can exercise the mapping without spinning up
// a fake S3.
export function storageErrorFromAwsException(thrown: unknown): StorageError {
  // The v3 AWS SDK throws plain objects with a `name` discriminator. We
  // pattern-match on that rather than `instanceof` so this still works
  // when the SDK ships a new error class we haven't imported.
  if (typeof thrown !== "object" || thrown === null) {
    return storageError("unknown", thrown instanceof Error ? thrown.message : String(thrown), thrown);
  }
  const name = (thrown as { name?: string }).name;
  const message = (thrown as { message?: string }).message ?? "unknown S3 error";
  switch (name) {
    case "NoSuchKey":
    case "NotFound":
      return storageError("not_found", message, thrown);
    case "NoSuchBucket":
      return storageError("bucket_unavailable", "bucket does not exist", thrown);
    case "AccessDenied":
    case "InvalidAccessKeyId":
    case "SignatureDoesNotMatch":
      return storageError("bucket_unavailable", `credentials rejected: ${message}`, thrown);
    case "EntityTooLarge":
    case "InvalidRequest":
      return storageError("invalid_request", message, thrown);
    case "TimeoutError":
    case "NetworkingError":
    case "RequestTimeout":
    case "ServiceUnavailable":
      return storageError("transient", message, thrown);
    default:
      // Fall through to status-code inspection for anything we haven't
      // enumerated above.
      break;
  }
  const status = (thrown as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  if (status === 404) return storageError("not_found", message, thrown);
  if (status === 403) return storageError("bucket_unavailable", message, thrown);
  if (status && status >= 500) return storageError("transient", message, thrown);
  return storageError("unknown", message, thrown);
}
