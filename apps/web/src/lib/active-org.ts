import { cookies } from "next/headers";
import { postLoginEvent } from "./api-client";

const COOKIE_NAME = "bgreen_active_org";

export async function getActiveOrgId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function setActiveOrgId(orgId: string): Promise<void> {
  const store = await cookies();
  const previous = store.get(COOKIE_NAME)?.value ?? null;
  store.set(COOKIE_NAME, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // 30 days; renewed each time it's set.
    maxAge: 60 * 60 * 24 * 30,
  });
  // V12.1 — emit a `user.login` audit row on first org pick AND on org
  // switch. The API dedupes within 60s so periodic refreshes (cookie
  // renewal on every /) don't spam. CS users are filtered server-side.
  if (orgId !== previous) {
    await postLoginEvent(orgId);
  }
}

export async function clearActiveOrgId(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
