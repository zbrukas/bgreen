// AuditWriter — pure helpers that turn an entity diff or a workflow event
// into the canonical JSONB payload persisted on `audit_log`.
//
// The module is intentionally small and dependency-free so unit tests can
// hammer it directly. The async write path lives in the service.

export type EntityDiffAction = "insert" | "update" | "delete";

export interface EntityDiffPayload {
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

// Compares two snapshots of the same entity and returns the canonical
// diff payload. Field-order independent; null-valued fields included
// when one side has them and the other does not.
export function buildEntityDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): EntityDiffPayload {
  if (before === null && after === null) {
    return { changedFields: [], before: null, after: null };
  }
  if (before === null) {
    return { changedFields: Object.keys(after ?? {}).sort(), before: null, after };
  }
  if (after === null) {
    return { changedFields: Object.keys(before).sort(), before, after: null };
  }
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (!sameValue(before[key], after[key])) changed.push(key);
  }
  changed.sort();
  return { changedFields: changed, before, after };
}

export interface WorkflowTransitionPayload {
  event: string;
  fromState: unknown;
  toState: unknown;
  comment?: string | null;
}

export function buildWorkflowTransition(
  input: WorkflowTransitionPayload,
): WorkflowTransitionPayload {
  return {
    event: input.event,
    fromState: input.fromState,
    toState: input.toState,
    comment: input.comment ?? null,
  };
}

// Stable structural equality good enough for audit purposes. Treats
// `undefined` and missing keys identically, normalises Date → ISO string,
// and recurses into plain objects + arrays.
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null || b === null) return a === b;
  if (a instanceof Date || b instanceof Date) {
    const av = a instanceof Date ? a.toISOString() : a;
    const bv = b instanceof Date ? b.toISOString() : b;
    return av === bv;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!sameValue(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const key of keys) {
      if (!sameValue(ao[key], bo[key])) return false;
    }
    return true;
  }
  return false;
}
