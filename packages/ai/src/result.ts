// Discriminated union so callers TS-narrow without try/catch around the AI client.
// Exceptions never escape @bgreen/ai — see CLAUDE.md.

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
