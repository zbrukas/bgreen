"use client";

import { useActionState } from "react";
import { type CreateInviteFormState, createInviteAction } from "../actions";

const initialState: CreateInviteFormState = {
  error: null,
  acceptUrl: null,
  invitedEmail: null,
  emailDelivered: null,
  emailReason: null,
};

interface InviteMemberFormProps {
  organizationId: string;
}

export function InviteMemberForm({ organizationId }: InviteMemberFormProps) {
  const actionWithOrg = createInviteAction.bind(null, organizationId);
  const [state, formAction, isPending] = useActionState(actionWithOrg, initialState);

  return (
    <div style={{ display: "grid", gap: "1.5rem", maxWidth: 480 }}>
      <form action={formAction} style={{ display: "grid", gap: "1rem" }}>
        <h2 style={{ margin: 0 }}>Convidar membro</h2>
        <p style={{ margin: 0, color: "#555" }}>
          O convidado tem de iniciar sessão com este email para aceitar.
        </p>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Papel</span>
          <select name="role" defaultValue="member" style={{ padding: "0.5rem", fontSize: "1rem" }}>
            <option value="member">Membro</option>
            <option value="admin">Administrador</option>
          </select>
        </label>

        {state.error && (
          <p style={{ color: "#b00020", margin: 0 }} role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          style={{ padding: "0.75rem 1rem", fontSize: "1rem" }}
        >
          {isPending ? "A criar…" : "Criar convite"}
        </button>
      </form>

      {state.acceptUrl && (
        <div
          style={{
            padding: "1rem",
            border: "1px solid #cde",
            background: "#f5fbff",
            borderRadius: "0.25rem",
            display: "grid",
            gap: "0.5rem",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>Convite criado para {state.invitedEmail}.</p>

          {state.emailDelivered === true && (
            <p style={{ margin: 0, color: "#1f7a3d", fontSize: "0.9rem" }}>✓ Email enviado.</p>
          )}
          {state.emailDelivered === false && (
            <p style={{ margin: 0, color: "#a36400", fontSize: "0.9rem" }}>
              ⚠ Email não foi enviado{state.emailReason ? ` (${state.emailReason})` : ""}. Partilhe
              o link manualmente.
            </p>
          )}

          <p style={{ margin: 0, fontSize: "0.9rem", color: "#444" }}>Link (validade: 7 dias):</p>
          <input
            type="text"
            readOnly
            value={state.acceptUrl}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: "100%",
              padding: "0.5rem",
              fontFamily: "monospace",
              fontSize: "0.85rem",
            }}
          />
        </div>
      )}
    </div>
  );
}
