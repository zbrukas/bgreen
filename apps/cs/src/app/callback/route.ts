import { handleAuth } from "@workos-inc/authkit-nextjs";

// WorkOS AuthKit callback for the CS console. Same exchange flow as
// the org-side app — they're independent origins with their own
// cookies and their own WorkOS redirect URI registered.
export const GET = handleAuth();
