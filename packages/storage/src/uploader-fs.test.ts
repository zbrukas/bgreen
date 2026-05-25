import { promises as fs } from "node:fs";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signDownloadUrl, verifyDownloadUrl } from "./signed-url";
import { FsUploader } from "./uploader-fs";

const SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaa";

describe("FsUploader", () => {
  let rootDir: string;
  let fsu: FsUploader;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(os.tmpdir(), "fs-uploader-"));
    fsu = new FsUploader({ rootDir, signingSecret: SECRET });
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("upload writes bytes under rootDir, creating parent dirs", async () => {
    const body = new TextEncoder().encode("hello world");
    const up = await fsu.upload({ key: "organizations/abc/ies/2025.pdf", body });
    expect(up.ok).toBe(true);

    const onDisk = await fs.readFile(path.join(rootDir, "organizations/abc/ies/2025.pdf"));
    expect(new TextDecoder().decode(onDisk)).toBe("hello world");
  });

  it("download roundtrips bytes", async () => {
    await fsu.upload({ key: "x/y.txt", body: "hello" });
    const down = await fsu.download("x/y.txt");
    expect(down.ok).toBe(true);
    if (down.ok) {
      expect(new TextDecoder().decode(down.value.body)).toBe("hello");
      expect(down.value.contentLength).toBe(5);
    }
  });

  it("download of missing key returns not_found", async () => {
    const down = await fsu.download("nope");
    expect(down.ok).toBe(false);
    if (!down.ok) expect(down.error.kind).toBe("not_found");
  });

  it("rejects oversized uploads with invalid_request", async () => {
    const up = await fsu.upload({ key: "k", body: "x".repeat(100), maxSizeBytes: 50 });
    expect(up.ok).toBe(false);
    if (!up.ok) expect(up.error.kind).toBe("invalid_request");
    // And nothing should have been written.
    await expect(fs.access(path.join(rootDir, "k"))).rejects.toBeTruthy();
  });

  it("delete is idempotent", async () => {
    expect((await fsu.delete("never-existed")).ok).toBe(true);
    await fsu.upload({ key: "k", body: "x" });
    expect((await fsu.delete("k")).ok).toBe(true);
    expect((await fsu.delete("k")).ok).toBe(true);
  });

  it("rejects path-traversal keys", async () => {
    for (const bad of ["../outside", "a/../../outside", "/abs/path", "with\0null"]) {
      const up = await fsu.upload({ key: bad, body: "x" });
      expect(up.ok).toBe(false);
      if (!up.ok) expect(up.error.kind).toBe("invalid_request");
    }
  });

  it("presignedUploadUrl is unsupported on fs", async () => {
    const r = await fsu.presignedUploadUrl("k");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid_request");
  });

  it("presignedDownloadUrl produces a verifiable URL", async () => {
    const r = await fsu.presignedDownloadUrl("organizations/abc/ies/2025.pdf");
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const url = new URL(r.value, "http://localhost");
    expect(url.pathname).toBe("/api/storage/download/organizations/abc/ies/2025.pdf");
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig") ?? "";
    expect(
      verifyDownloadUrl(SECRET, "organizations/abc/ies/2025.pdf", sig, exp).ok,
    ).toBe(true);
  });

  it("publicBaseUrl prefixes signed URLs without trailing slash duplication", async () => {
    const u = new FsUploader({
      rootDir,
      signingSecret: SECRET,
      publicBaseUrl: "https://api.example.com/",
    });
    const r = await u.presignedDownloadUrl("k");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.startsWith("https://api.example.com/api/storage/download/k?")).toBe(true);
  });
});

describe("signed-url", () => {
  it("verifies a freshly signed URL", () => {
    const { exp, sig } = signDownloadUrl(SECRET, "k", 60);
    expect(verifyDownloadUrl(SECRET, "k", sig, exp).ok).toBe(true);
  });

  it("rejects an expired sig", () => {
    // exp 10s ago.
    const exp = Math.floor(Date.now() / 1000) - 10;
    const sig = signDownloadUrl(SECRET, "k", -10).sig;
    const v = verifyDownloadUrl(SECRET, "k", sig, exp);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("expired");
  });

  it("rejects a tampered sig", () => {
    const { exp, sig } = signDownloadUrl(SECRET, "k", 60);
    // Flip a char in the sig.
    const tampered = sig[0] === "A" ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
    const v = verifyDownloadUrl(SECRET, "k", tampered, exp);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad_signature");
  });

  it("rejects a sig signed for a different key", () => {
    const { exp, sig } = signDownloadUrl(SECRET, "k1", 60);
    const v = verifyDownloadUrl(SECRET, "k2", sig, exp);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad_signature");
  });

  it("rejects a sig signed with a different secret", () => {
    const { exp, sig } = signDownloadUrl(SECRET, "k", 60);
    const v = verifyDownloadUrl("other-secret", "k", sig, exp);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad_signature");
  });

  it("rejects a non-finite exp as malformed", () => {
    const v = verifyDownloadUrl(SECRET, "k", "sig", Number.NaN);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("malformed");
  });
});
