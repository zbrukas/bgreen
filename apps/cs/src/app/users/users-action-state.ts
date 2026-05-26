// Shared shape + initial value for the useActionState-driven forms in
// UsersTable. Lives outside actions.ts because a "use server" file can
// only export async functions — exporting the `initialCsUserActionState`
// const from there violates Next's invalid-use-server-value rule.
//
// actions.ts imports the type (type-only imports are erased), so the
// "use server" file stays compliant.

export type CsUserActionState =
  | { ok: null }
  | { ok: true }
  | { ok: false; error: string };

export const initialCsUserActionState: CsUserActionState = { ok: null };
