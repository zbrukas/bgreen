"use client";

import { Select } from "@/components/ui/select";
import { useRef } from "react";
import { switchActiveOrganizationAction } from "../../actions";

interface OrganizationSwitcherProps {
  organizations: Array<{ id: string; name: string }>;
  activeOrganizationId: string | null;
}

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
}: OrganizationSwitcherProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={switchActiveOrganizationAction}>
      <label htmlFor="active-org" className="inline-flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Organização:</span>
        <Select
          id="active-org"
          name="organizationId"
          defaultValue={activeOrganizationId ?? ""}
          onChange={(e) => {
            if (e.currentTarget.value) formRef.current?.requestSubmit();
          }}
          className="h-8 w-auto py-0 text-sm"
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </label>
    </form>
  );
}
