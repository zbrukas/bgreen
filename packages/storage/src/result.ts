// Local Result type — same shape as @bgreen/ai's. Duplicated rather than
// shared to keep packages decoupled (storage shouldn't depend on ai).

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
