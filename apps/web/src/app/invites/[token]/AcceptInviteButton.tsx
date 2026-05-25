"use client";

import { acceptInviteAction } from "@/app/actions";
import { Checkmark } from "@carbon/icons-react";
import { Button } from "@carbon/react";

export function AcceptInviteButton({ token }: { token: string }) {
  return (
    <form action={acceptInviteAction}>
      <input type="hidden" name="token" value={token} />
      <Button type="submit" kind="primary" size="lg" renderIcon={Checkmark}>
        Aceitar convite
      </Button>
    </form>
  );
}
