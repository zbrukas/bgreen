# apps/pdf — Gotenberg wrapper

Bounded context: HTML+CSS → PDF rendering, isolated for scaling. Receives data from `apps/api`, returns PDF bytes.

## Owns (from V10 onward)
- React Server Component templates for reports (`templates/<framework>.tsx`).
- HTTP wrapper around Gotenberg.

## Does NOT own
- Data collection. `apps/api` does that and sends a hydrated payload.
- AI commentary generation. `apps/api` does that and embeds commentary in the payload.

## Constraints
- Only reachable from `apps/api` (internal network or auth header on private route).
- Stateless — no DB access.
- Gotenberg lives in compose locally and as a private production service; this service is the HTTP shim.
