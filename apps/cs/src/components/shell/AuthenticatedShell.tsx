import { signOutAction } from "@/app/actions";
import { fetchMe } from "@/lib/api-client";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

// Server wrapper. Middleware already redirects unauth requests to /login
// for any non-public route, so by the time we reach here we either have
// a valid session (render the shell) or we are on /login or
// /setup-password (render bare children). The fetchMe() can still fail
// transiently — in that case we skip the shell rather than crash.

export async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const me = await fetchMe();
  if (!me) return <>{children}</>;

  return (
    <AppShell
      user={{ email: me.email }}
      role={me.centralServicesRole}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
