import { type NextRequest, NextResponse } from "next/server";

// V5.7: CS uses local email+password auth, not WorkOS. The middleware
// only checks for the cs_session cookie; signature verification happens
// server-side when the API receives the token. Unauthenticated requests
// to anything except /login and /setup-password get bounced to /login.

const PUBLIC_PATHS = new Set(["/login", "/setup-password"]);
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
