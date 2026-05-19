"use client";

import { useRef } from "react";
import { switchActiveOrganizationAction } from "../actions";

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
      <label
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}
      >
        <span>Organização:</span>
        <select
          name="organizationId"
          defaultValue={activeOrganizationId ?? ""}
          onChange={(e) => {
            if (e.currentTarget.value) formRef.current?.requestSubmit();
          }}
          style={{ padding: "0.35rem 0.5rem", fontSize: "0.9rem" }}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
