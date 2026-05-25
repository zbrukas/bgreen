# packages/storage — S3Uploader

Bounded context: object-storage transport. Wraps the underlying storage
SDK so callers never import `@aws-sdk/*` or `node:fs` directly.

The `S3Uploader` interface is named for historical reasons — it is
transport-agnostic and has implementations for both real S3 and the
local filesystem.

## Owns
- `S3Uploader` interface — `upload`, `download`, `presignedUploadUrl`,
  `presignedDownloadUrl`, `delete`.
- `AwsS3Uploader` — real impl. Targets EU bucket in prod; MinIO via
  `endpoint` override in dev.
- `FsUploader` — local-filesystem impl. Used when `STORAGE_DRIVER=fs`.
  Mirrors the legacy bgreen strategy (files on disk, partitioned by
  caller-owned keys under a configured root directory).
- `InMemoryS3Uploader` — test + dev fallback. Same interface, no AWS or
  filesystem dependency at runtime.
- `signDownloadUrl` / `verifyDownloadUrl` — HMAC-SHA256 helpers used by
  the fs backend and the apps/api download route.
- `StorageError` discriminated union.

## Does NOT own
- Object naming conventions (callers decide
  `organizations/{orgId}/ies/{uploadId}.pdf`).
- Lifecycle (TTL on extracted-IES objects) — `IesExtractionService`
  schedules the delete after extraction.
- Token / cost accounting.
- The HTTP route that serves signed fs downloads. Lives in
  `apps/api/src/routes/storage-download.ts` — this package exposes the
  HMAC verifier it consumes.

## Drivers
Pick at startup via `STORAGE_DRIVER`:

| value     | impl                  | use case                              |
|-----------|-----------------------|---------------------------------------|
| `fs`      | `FsUploader`          | legacy parity; local disk             |
| `s3`      | `AwsS3Uploader`       | real S3 / MinIO                       |
| `memory`  | `InMemoryS3Uploader`  | tests + smoke runs                    |

When `STORAGE_DRIVER` is unset, the factory infers a driver from which
env is present:
- `STORAGE_URL_SIGNING_SECRET` set → `fs`
- `S3_BUCKET` set → `s3`
- neither set → `memory`

This keeps tests-with-no-env working (they get `memory`) while letting
operators configure fs or s3 by just dropping in the right env.

### fs driver
Env vars:
- `STORAGE_LOCAL_ROOT` — root directory (default `./data/storage`).
- `STORAGE_URL_SIGNING_SECRET` — **required**. HMAC secret used to sign
  download URLs. Startup fails if unset.
- `STORAGE_PUBLIC_BASE_URL` — optional URL prefix prepended to signed
  URLs (e.g. `https://api.example.com`). Omit to emit path-only URLs.

Presigned uploads are **not supported** on the fs driver — there is no
filesystem equivalent of S3 PUT-via-URL. Callers must POST through an
API route that invokes `upload()` server-side.

Presigned downloads return an HMAC-signed URL pointing at
`GET /api/storage/download/{key}?exp=...&sig=...` in apps/api. The route
verifies the signature, then streams from disk. Possession of a valid
non-expired URL is sufficient authorization — same model as S3
presigning, so callers must run their own access checks before minting
the URL.

### s3 driver
Env vars: `S3_BUCKET` (required), `AWS_REGION`, `S3_ENDPOINT` (for
MinIO), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Presigning is
native.

## Rule
- Exceptions never escape this package. All public methods return
  `Result<T, StorageError>` (Result type defined locally — same shape
  as `@bgreen/ai`'s; deliberately duplicated to keep packages
  decoupled).
