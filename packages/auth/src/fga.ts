// FGA helper — wraps WorkOS FGA `check` and `writeWarrant` with a
// per-request cache. Strict mode (no membership-role fallback): if FGA
// rejects the check, the caller gets a deny. Failures from the WorkOS
// API propagate up so they're visible instead of silently failing-open.

import { AsyncLocalStorage } from "node:async_hooks";

export type FgaResourceKind =
  | "user"
  | "organization"
  | "record"
  | "record_template"
  | "central_services_workspace";

// V5.4: org-side roles split into three. CS workspace gets its own
// relation set. record/record_template relations stay narrow in v1.
export type OrgRelation = "org_admin" | "org_user_write" | "org_user_read";
export type CsRelation = "admin" | "maintainer" | "promoter";
export type RecordRelation = "submitter" | "reviewer";
export type TemplateRelation = "editor";
export type AnyRelation = OrgRelation | CsRelation | RecordRelation | TemplateRelation;

export interface FgaActor {
  kind: "user";
  id: string;
}

export interface FgaResource {
  kind: FgaResourceKind;
  id: string;
}

// Minimal FGA-client surface we depend on. Mirrors the bits of
// @workos-inc/node's `workos.fga` we use so tests can fake it without
// pulling the whole SDK in.
export interface FgaClient {
  check(input: {
    resource: { resourceType: string; resourceId: string };
    relation: string;
    subject: { resourceType: string; resourceId: string };
  }): Promise<boolean>;
  writeWarrant(input: {
    resource: { resourceType: string; resourceId: string };
    relation: string;
    subject: { resourceType: string; resourceId: string };
  }): Promise<void>;
}

// AsyncLocalStorage carries the per-request decision cache. A request
// enters via `runWithCache`; every `can()` inside that scope shares the
// map. If no scope is active the call still works — just without the
// cache.
const requestCache = new AsyncLocalStorage<Map<string, boolean>>();

export function runWithCache<R>(fn: () => Promise<R>): Promise<R> {
  return requestCache.run(new Map(), fn);
}

export interface CanArgs {
  actor: FgaActor;
  action: AnyRelation;
  resource: FgaResource;
}

// Performs an FGA check. Cache key is (actor|action|resource); identical
// checks in the same request hit the cache. Errors propagate.
export async function can(client: FgaClient, args: CanArgs): Promise<boolean> {
  const key = cacheKey(args);
  const cache = requestCache.getStore();
  const cached = cache?.get(key);
  if (cached !== undefined) return cached;

  const ok = await client.check({
    resource: { resourceType: args.resource.kind, resourceId: args.resource.id },
    relation: args.action,
    subject: { resourceType: args.actor.kind, resourceId: args.actor.id },
  });
  cache?.set(key, ok);
  return ok;
}

// Convenience for routes — throws an `FgaDeniedError` when the actor
// lacks the relation. Use this in service code; the Hono middleware
// turns it into a 403.
export class FgaDeniedError extends Error {
  constructor(public readonly args: CanArgs) {
    super(
      `fga: actor ${args.actor.id} lacks ${args.action} on ${args.resource.kind}:${args.resource.id}`,
    );
    this.name = "FgaDeniedError";
  }
}

export async function requireCan(client: FgaClient, args: CanArgs): Promise<void> {
  const ok = await can(client, args);
  if (!ok) throw new FgaDeniedError(args);
}

function cacheKey(args: CanArgs): string {
  return `${args.actor.kind}:${args.actor.id}|${args.action}|${args.resource.kind}:${args.resource.id}`;
}
