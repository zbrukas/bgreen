import { type NextRequest, NextResponse } from "next/server";

// V5.7: CS uses local email+password auth, not WorkOS. The middleware
// only checks for the cs_session cookie; signature verification happens
// server-side when the API receives the token. Unauthenticated requests
// to anything except /login and /setup-password get bounced to /login.

// /design is the dev-only Carbon design showcase (Phase 0 of the UI
// migration — plans/ui-carbon-migration/README.md). The page returns
// notFound() in production, so it is safe to skip auth here.
const PUBLIC_PATHS = new Set(["/login", "/setup-password", "/design"]);
const SESSION_COOKIE = "cs_session";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
