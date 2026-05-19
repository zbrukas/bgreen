import { cookies } from "next/headers";

const COOKIE_NAME = "bgreen_active_org";

export async function getActiveOrgId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function setActiveOrgId(orgId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // 30 days; renewed each time it's set.
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearActiveOrgId(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
