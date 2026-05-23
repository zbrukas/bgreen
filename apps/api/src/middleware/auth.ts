import { JoseWorkosJwtVerifier, type WorkosJwtVerifier } from "@bgreen/auth";
import { WorkOS } from "@workos-inc/node";
import { createMiddleware } from "hono/factory";
import { ACTIVE_ORGANIZATION_HEADER, type AppEnv } from "../context.js";
// Import directly from the leaf file rather than the module barrel. The
// barrel re-exports routes.ts, which transitively pulls in services.ts —
// the same file that needs CsAuthService — and we'd hit a TDZ cycle.
import { looksLikeCsSession, verifyCsSession } from "../modules/cs-auth/application/cs-session.js";
import { repositories, userService } from "../services.js";

let _verifier: WorkosJwtVerifier | null = null;
let _workos: WorkOS | null = null;

function getVerifier(): WorkosJwtVerifier {
  if (_verifier) return _verifier;
  const clientId = process.env.WORKOS_CLIENT_ID;
  if (!clientId) {
    throw new Error("WORKOS_CLIENT_ID env var is required for auth middleware");
  }
  _verifier = new JoseWorkosJwtVerifier(clientId);
  return _verifier;
}

function getWorkos(): WorkOS {
  if (_workos) return _workos;
  const apiKey = process.env.WORKOS_API_KEY;
  if (!apiKey) {
    throw new Error("WORKOS_API_KEY env var is required for WorkOS user sync");
  }
  _workos = new WorkOS(apiKey);
  return _workos;
}

// V5.7: the API accepts two token shapes on the same Authorization header:
//   * WorkOS JWT (3-segment dot-separated, used by apps/web org users)
//   * CS session token (prefix "cs.", HMAC-signed, used by apps/cs)
// Both resolve to the same `c.var.user` shape downstream; no caller needs
// to know which path was taken.
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "missing_token" }, 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();

  if (looksLikeCsSession(token)) {
    const verified = verifyCsSession(token);
    if (!verified.ok) return c.json({ error: "invalid_token", reason: verified.reason }, 401);
    const user = await repositories.users.findById(verified.payload.sub);
    if (!user || user.userType !== "central_services") {
      return c.json({ error: "invalid_token" }, 401);
    }
    c.set("user", user);
    // CS users have no active org context — the CS routes don't read it.
    await next();
    return;
  }

  const claims = await getVerifier().verify(token);
  if (!claims) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const workosUserId = claims.sub;

  let user = await userService.getByWorkosUserId(workosUserId);
  if (!user) {
    // First sign-in — fetch profile + upsert bGreen User row.
    const workosUser = await getWorkos().userManagement.getUser(workosUserId);
    user = await userService.syncFromWorkos({
      workosUserId,
      email: workosUser.email,
      firstName: workosUser.firstName ?? null,
      lastName: workosUser.lastName ?? null,
    });
  }

  c.set("user", user);
  c.set("workosUserId", workosUserId);

  // Optional active-org context. Header present + valid membership → set scope.
  // Header present + no membership → 403. Header absent → leave undefined.
  const orgIdHeader = c.req.header(ACTIVE_ORGANIZATION_HEADER);
  if (orgIdHeader) {
    const memberships = await repositories.memberships.listForUser(user.id);
    const match = memberships.find((m) => m.organizationId === orgIdHeader);
    if (!match) {
      return c.json({ error: "forbidden", reason: "not a member of this organization" }, 403);
    }
    c.set("organizationId", match.organizationId);
    c.set("membershipRole", match.role);
  }

  await next();
  return;
});
