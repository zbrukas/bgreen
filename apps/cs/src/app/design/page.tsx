// Phase 0 of the Carbon migration — see plans/ui-carbon-migration/README.md.
// Mirror of apps/web /_design with compact density (size="sm" defaults).
// CS is a power-user surface — template editor, inbox, review — so the
// tighter density helps with information-per-screen.

import { notFound } from "next/navigation";
import { DesignShowcase } from "./DesignShowcase";

export const dynamic = "force-dynamic";

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignShowcase />;
}
