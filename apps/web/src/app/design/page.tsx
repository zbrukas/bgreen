// Phase 0 of the Carbon migration — see plans/ui-carbon-migration/README.md.
// Living style guide. Every section here is the bGreen-themed Carbon look
// we will roll across the real pages in Phase 1+. Dev-only.

import { notFound } from "next/navigation";
import { DesignShowcase } from "./DesignShowcase";

export const dynamic = "force-dynamic";

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignShowcase />;
}
