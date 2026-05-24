# packages/storage — S3Uploader

Bounded context: object-storage transport. Wraps AWS SDK so callers never
import `@aws-sdk/*` directly.

## Owns (from V6 onward)
- `S3Uploader` interface — `upload`, `presignedUploadUrl`, `presignedDownloadUrl`, `delete`.
- `AwsS3Uploader` — real impl. Targets EU bucket in prod; MinIO via `endpoint` override in dev.
- `InMemoryS3Uploader` — test + dev fallback. Same interface, no AWS dependency at runtime.
- `StorageError` discriminated union.

## Does NOT own
- Object naming conventions (callers decide `organizations/{orgId}/ies/{uploadId}.pdf`).
- Lifecycle (TTL on extracted-IES objects) — `IesExtractionService` schedules the delete after extraction.
- Token / cost accounting.

## Rule
- Exceptions never escape this package. All public methods return
  `Result<T, StorageError>` (Result type defined locally — same shape as
  `@bgreen/ai`'s; deliberately duplicated to keep packages decoupled).
