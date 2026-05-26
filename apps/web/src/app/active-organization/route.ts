import { clearActiveOrgId, setActiveOrgId } from "@/lib/active-org";
import { fetchMyOrganizations } from "@/lib/api-client";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  if (!organizationId) {
    await clearActiveOrgId();
    return NextResponse.redirect(new URL(returnTo, url.origin));
  }

  const orgs = await fetchMyOrganizations();
  if (!orgs.some((org) => org.id === organizationId)) {
    await clearActiveOrgId();
    return NextResponse.redirect(new URL(returnTo, url.origin));
  }

  await setActiveOrgId(organizationId);
  return NextResponse.redirect(new URL(returnTo, url.origin));
}

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
