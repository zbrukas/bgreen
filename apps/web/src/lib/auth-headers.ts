export function buildAuthHeaders(input: {
  accessToken: string | null | undefined;
  activeOrganizationId?: string | null;
  includeActiveOrganization?: boolean;
}): Record<string, string> {
  if (!input.accessToken) return {};
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
  };
  if (input.includeActiveOrganization !== false && input.activeOrganizationId) {
    headers["X-Organization-Id"] = input.activeOrganizationId;
  }
  return headers;
}
