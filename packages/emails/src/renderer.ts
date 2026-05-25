// Email template renderer — thin wrapper around Eta.
//
// Templates live in `packages/emails/templates/` (sibling of src/).
// At runtime we resolve the folder relative to this module via
// `import.meta.url`, which works under both tsx (dev) and the
// installed source-of-truth layout in the monorepo. ETA escapes via
// `<%= %>` by default, so call sites pass raw user data — no need
// for an `escapeHtml` helper at the boundary.
//
// Caching is on; same template path is parsed once per process.

import { Eta } from "eta";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// `src/` → `../templates`. The package layout pins this; rotating
// templates somewhere else needs a matching edit here.
const TEMPLATES_DIR = resolve(here, "../templates");

const eta = new Eta({
  views: TEMPLATES_DIR,
  cache: true,
});

// Re-export so per-email modules render in a single call. The
// generic keeps `data` shape-checked at the call site.
export function renderEmailTemplate<TData extends Record<string, unknown>>(
  templatePath: string,
  data: TData,
): string {
  return eta.render(templatePath, data);
}
