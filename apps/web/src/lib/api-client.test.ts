import { describe, expect, it } from "vitest";
import { buildAuthHeaders } from "./auth-headers";

describe("buildAuthHeaders", () => {
  it("can omit the active organization header for organization-list recovery", () => {
    expect(
      buildAuthHeaders({
        accessToken: "token-1",
        activeOrganizationId: "stale-org-id",
        includeActiveOrganization: false,
      }),
    ).toEqual({ Authorization: "Bearer token-1" });
  });

  it("includes the active organization header by default", () => {
    expect(
      buildAuthHeaders({
        accessToken: "token-1",
        activeOrganizationId: "org-id",
      }),
    ).toEqual({
      Authorization: "Bearer token-1",
      "X-Organization-Id": "org-id",
    });
  });
});
