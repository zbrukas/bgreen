// S3Uploader — typed facade over object storage.
//
// Two implementations:
//   - AwsS3Uploader: production. Targets real S3 (eu-central-1 / eu-west-1)
//     or MinIO in dev (set `endpoint` + `forcePathStyle: true`).
//   - InMemoryS3Uploader (uploader-in-memory.ts): unit tests; viable dev
//     fallback if MinIO isn't running.
//
// The interface returns `Result<T, StorageError>` so AWS exceptions never
// surface to callers. See errors.ts for the mapping.

import {
  DeleteObjectCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type StorageError, storageErrorFromAwsException } from "./errors";
import { type Result, err, ok } from "./result";

export interface UploadInput {
  // Object key (e.g., "organizations/abc/ies/2025-01-15-original.pdf").
  // Callers own the naming convention.
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  // Optional client-side cap. AWS hard limit on a single PUT is 5 GiB; bGreen
  // enforces stricter caps at the caller (25 MB on IES PDFs).
  maxSizeBytes?: number;
}

export interface PresignOptions {
  // URL TTL. Defaults to 15 minutes — long enough for a slow upload, short
  // enough that a leaked URL goes stale before exploitation.
  expiresInSeconds?: number;
  contentType?: string;
}

export interface DownloadResult {
  body: Uint8Array;
  contentType?: string;
  contentLength?: number;
}

export interface S3Uploader {
  upload(input: UploadInput): Promise<Result<void, StorageError>>;
  download(key: string): Promise<Result<DownloadResult, StorageError>>;
  presignedUploadUrl(key: string, options?: PresignOptions): Promise<Result<string, StorageError>>;
  presignedDownloadUrl(key: string, options?: PresignOptions): Promise<Result<string, StorageError>>;
  delete(key: string): Promise<Result<void, StorageError>>;
}

export interface AwsS3UploaderConfig {
  bucket: string;
  region: string;
  // Override for MinIO / LocalStack. Omit in prod — defaults to the regional
  // AWS endpoint.
  endpoint?: string;
  // Required for MinIO and most non-AWS S3 services: addresses buckets as
  // `endpoint/bucket/key` instead of `bucket.endpoint/key`.
  forcePathStyle?: boolean;
  // Override credentials. Omit in prod — uses the standard AWS credential
  // chain (env / shared config / instance metadata).
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

export class AwsS3Uploader implements S3Uploader {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: AwsS3UploaderConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credentials,
    });
  }

  async upload(input: UploadInput): Promise<Result<void, StorageError>> {
    if (input.maxSizeBytes !== undefined) {
      const size = sizeOf(input.body);
      if (size > input.maxSizeBytes) {
        return err({
          kind: "invalid_request",
          message: `object size ${size} exceeds caller-provided max ${input.maxSizeBytes}`,
        });
      }
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
      return ok(undefined);
    } catch (e) {
      return err(storageErrorFromAwsException(e));
    }
  }

  async download(key: string): Promise<Result<DownloadResult, StorageError>> {
    try {
      const out: GetObjectCommandOutput = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!out.Body) {
        return err({ kind: "not_found", message: `empty body for key ${key}` });
      }
      const body = await out.Body.transformToByteArray();
      return ok({
        body,
        contentType: out.ContentType,
        contentLength: out.ContentLength,
      });
    } catch (e) {
      return err(storageErrorFromAwsException(e));
    }
  }

  async presignedUploadUrl(
    key: string,
    options: PresignOptions = {},
  ): Promise<Result<string, StorageError>> {
    try {
      const url = await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: options.contentType,
        }),
        { expiresIn: options.expiresInSeconds ?? 900 },
      );
      return ok(url);
    } catch (e) {
      return err(storageErrorFromAwsException(e));
    }
  }

  async presignedDownloadUrl(
    key: string,
    options: PresignOptions = {},
  ): Promise<Result<string, StorageError>> {
    try {
      const url = await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: options.expiresInSeconds ?? 900 },
      );
      return ok(url);
    } catch (e) {
      return err(storageErrorFromAwsException(e));
    }
  }

  async delete(key: string): Promise<Result<void, StorageError>> {
    try {
      // S3 DeleteObject is idempotent — deleting a missing key returns 204,
      // not an error. We don't need to special-case "not_found" here.
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return ok(undefined);
    } catch (e) {
      return err(storageErrorFromAwsException(e));
    }
  }
}

function sizeOf(body: UploadInput["body"]): number {
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  return body.byteLength;
}
