import { handleAuth } from "@workos-inc/authkit-nextjs";

// WorkOS AuthKit redirects here after a successful sign-in.
// handleAuth() exchanges the code for tokens and persists the session cookie.
export const GET = handleAuth();
