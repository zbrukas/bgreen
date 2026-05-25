import { signOutAction } from "@/app/actions";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

// Server wrapper around AppShell. Fetches the WorkOS session + org
// memberships once at the layout level, then hands them to the client
// shell. Unauthenticated requests render children without chrome —
// keeps /, /callback, /invites/[token], and CS-bound users from seeing
// org-org navigation they don't have access to.

export async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const auth = await withAuth();
  if (!auth.user) return <>{children}</>;

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);

  // CS users belong in the CS console — don't render the org-side shell
  // for them. The Home page handles the redirect; here we just stay
  // chrome-less so a transient race doesn't flash the wrong nav.
  if (me?.userType === "central_services") return <>{children}</>;

  // Onboarding state: no orgs yet. Render the home/create-org flow without
  // shell since the nav items have nothing to point at.
  if (orgs.length === 0) return <>{children}</>;

  return (
    <AppShell
      user={{ email: auth.user.email }}
      organizations={orgs}
      activeOrganizationId={activeOrgId}
      activeOrganizationRole={me?.activeOrganizationRole ?? null}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
