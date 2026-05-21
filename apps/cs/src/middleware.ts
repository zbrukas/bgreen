import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

// AuthKit middleware refreshes the WorkOS session on every request.
// Same setup as apps/web — both run their own AuthKit since cookies are
// per-origin and they live on different ports/subdomains.
export default authkitMiddleware();

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
