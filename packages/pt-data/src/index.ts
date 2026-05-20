// Lightweight PT-jurisdiction utilities — safe to import from any app.
// Heavier reference catalogs (CAE Rev.4, postal codes) live in Postgres
// and are served via apps/api `/lookups/*` endpoints.

export { type NifValidationResult, validateNif } from "./nif";
export {
  HttpViesClient,
  type HttpViesClientOptions,
  type ViesClient,
  type ViesResult,
} from "./vies";
