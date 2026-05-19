import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

// AuthKit middleware refreshes the WorkOS session on every request and exposes
// it via `withAuth()` in server components / route handlers. Auth enforcement
// is per-route (via `withAuth({ ensureSignedIn: true })`), not blanket here.
export default authkitMiddleware();

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
