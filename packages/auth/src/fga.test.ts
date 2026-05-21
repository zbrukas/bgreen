import { describe, expect, it, vi } from "vitest";
import { type FgaClient, FgaDeniedError, can, requireCan, runWithCache } from "./fga.js";

function fakeClient(allow: boolean): FgaClient & { calls: number } {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async check() {
      calls++;
      return allow;
    },
    async writeWarrant() {},
  } as FgaClient & { calls: number };
}

describe("can()", () => {
  it("returns the FGA decision when allowed", async () => {
    const client = fakeClient(true);
    const result = await can(client, {
      actor: { kind: "user", id: "u1" },
      action: "org_admin",
      resource: { kind: "organization", id: "o1" },
    });
    expect(result).toBe(true);
  });

  it("returns false when FGA denies", async () => {
    const client = fakeClient(false);
    expect(
      await can(client, {
        actor: { kind: "user", id: "u1" },
        action: "org_admin",
        resource: { kind: "organization", id: "o1" },
      }),
    ).toBe(false);
  });

  it("caches identical checks in the same request scope", async () => {
    const client = fakeClient(true);
    await runWithCache(async () => {
      for (let i = 0; i < 4; i++) {
        await can(client, {
          actor: { kind: "user", id: "u1" },
          action: "org_admin",
          resource: { kind: "organization", id: "o1" },
        });
      }
    });
    expect(client.calls).toBe(1);
  });

  it("does not cache across distinct resources/actions", async () => {
    const client = fakeClient(true);
    await runWithCache(async () => {
      await can(client, {
        actor: { kind: "user", id: "u1" },
        action: "org_admin",
        resource: { kind: "organization", id: "o1" },
      });
      await can(client, {
        actor: { kind: "user", id: "u1" },
        action: "org_user_write",
        resource: { kind: "organization", id: "o1" },
      });
      await can(client, {
        actor: { kind: "user", id: "u1" },
        action: "org_admin",
        resource: { kind: "organization", id: "o2" },
      });
    });
    expect(client.calls).toBe(3);
  });

  it("works without a request scope (no cache)", async () => {
    const client = fakeClient(true);
    await can(client, {
      actor: { kind: "user", id: "u1" },
      action: "org_admin",
      resource: { kind: "organization", id: "o1" },
    });
    await can(client, {
      actor: { kind: "user", id: "u1" },
      action: "org_admin",
      resource: { kind: "organization", id: "o1" },
    });
    expect(client.calls).toBe(2);
  });
});

describe("requireCan()", () => {
  it("throws FgaDeniedError when the check fails", async () => {
    const client = fakeClient(false);
    const args = {
      actor: { kind: "user" as const, id: "u1" },
      action: "org_admin" as const,
      resource: { kind: "organization" as const, id: "o1" },
    };
    await expect(requireCan(client, args)).rejects.toBeInstanceOf(FgaDeniedError);
  });

  it("returns normally when the check passes", async () => {
    const client = fakeClient(true);
    await expect(
      requireCan(client, {
        actor: { kind: "user", id: "u1" },
        action: "org_admin",
        resource: { kind: "organization", id: "o1" },
      }),
    ).resolves.toBeUndefined();
  });

  it("propagates client errors instead of failing open", async () => {
    const client: FgaClient = {
      async check() {
        throw new Error("network down");
      },
      async writeWarrant() {},
    };
    const onCheck = vi.spyOn(client, "check");
    await expect(
      requireCan(client, {
        actor: { kind: "user", id: "u1" },
        action: "org_admin",
        resource: { kind: "organization", id: "o1" },
      }),
    ).rejects.toThrow("network down");
    expect(onCheck).toHaveBeenCalledOnce();
  });
});
