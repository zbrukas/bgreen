import { describe, expect, it } from "vitest";
import { storageErrorFromAwsException } from "./errors";
import { InMemoryS3Uploader } from "./uploader-in-memory";

// The in-memory implementation gives us a real exerciser for the
// interface contract. AWS impl tests would need either @aws-sdk/client-mock
// or LocalStack — both add infra weight without proving anything the
// error-mapping unit test below doesn't already cover.

describe("InMemoryS3Uploader", () => {
  it("upload + download roundtrips bytes and content type", async () => {
    const s3 = new InMemoryS3Uploader();
    const body = new TextEncoder().encode("hello world");
    const up = await s3.upload({ key: "x/y.txt", body, contentType: "text/plain" });
    expect(up.ok).toBe(true);

    const down = await s3.download("x/y.txt");
    expect(down.ok).toBe(true);
    if (down.ok) {
      expect(new TextDecoder().decode(down.value.body)).toBe("hello world");
      expect(down.value.contentType).toBe("text/plain");
      expect(down.value.contentLength).toBe(11);
    }
  });

  it("rejects oversized uploads with invalid_request", async () => {
    const s3 = new InMemoryS3Uploader();
    const body = "x".repeat(100);
    const up = await s3.upload({ key: "k", body, maxSizeBytes: 50 });
    expect(up.ok).toBe(false);
    if (!up.ok) {
      expect(up.error.kind).toBe("invalid_request");
    }
    expect(s3.has("k")).toBe(false);
  });

  it("download of missing key returns not_found", async () => {
    const s3 = new InMemoryS3Uploader();
    const result = await s3.download("missing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not_found");
    }
  });

  it("delete is idempotent — removing a missing key is ok (matches S3 semantics)", async () => {
    const s3 = new InMemoryS3Uploader();
    const first = await s3.delete("never-existed");
    expect(first.ok).toBe(true);

    await s3.upload({ key: "k", body: "x" });
    expect(s3.has("k")).toBe(true);
    const second = await s3.delete("k");
    expect(second.ok).toBe(true);
    expect(s3.has("k")).toBe(false);

    // And again — still not an error.
    const third = await s3.delete("k");
    expect(third.ok).toBe(true);
  });

  it("presigned URLs include the encoded key so callers can sanity-check them", async () => {
    const s3 = new InMemoryS3Uploader();
    const up = await s3.presignedUploadUrl("organizations/abc/ies/2025.pdf");
    expect(up.ok).toBe(true);
    if (up.ok) {
      expect(up.value).toContain("upload");
      expect(up.value).toContain(encodeURIComponent("organizations/abc/ies/2025.pdf"));
    }
    const down = await s3.presignedDownloadUrl("k");
    expect(down.ok).toBe(true);
  });
});

describe("storageErrorFromAwsException", () => {
  it("maps NoSuchKey to not_found", () => {
    const e = storageErrorFromAwsException({ name: "NoSuchKey", message: "no such" });
    expect(e.kind).toBe("not_found");
  });

  it("maps AccessDenied to bucket_unavailable (treated as credentials issue)", () => {
    const e = storageErrorFromAwsException({ name: "AccessDenied", message: "denied" });
    expect(e.kind).toBe("bucket_unavailable");
  });

  it("falls back to httpStatusCode when name is unrecognized — 404 → not_found", () => {
    const e = storageErrorFromAwsException({
      name: "SomethingNew",
      message: "weird",
      $metadata: { httpStatusCode: 404 },
    });
    expect(e.kind).toBe("not_found");
  });

  it("falls back to httpStatusCode — 503 → transient", () => {
    const e = storageErrorFromAwsException({
      name: "SomethingNew",
      message: "weird",
      $metadata: { httpStatusCode: 503 },
    });
    expect(e.kind).toBe("transient");
  });

  it("non-object thrown values become unknown", () => {
    const e = storageErrorFromAwsException("a string");
    expect(e.kind).toBe("unknown");
  });
});
