// URL helpers shared by the table toolbar + sort headers.
//
// `patchSearchParams(current, patch)` returns a new query string with the
// given keys overlaid on top of the existing params. Setting a key to
// `null` or "" removes it. Order of keys is stable so refreshes don't
// shuffle the URL.

export function patchSearchParams(
  current: URLSearchParams | ReadonlyURLSearchParamsLike,
  patch: Record<string, string | null | undefined>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  const str = next.toString();
  return str ? `?${str}` : "";
}

// Minimal structural type — covers both Next's ReadonlyURLSearchParams and
// the standard URLSearchParams, without depending on next/navigation here.
interface ReadonlyURLSearchParamsLike {
  toString(): string;
  get(name: string): string | null;
}
