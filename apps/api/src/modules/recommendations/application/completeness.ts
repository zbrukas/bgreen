// Picks the prompt template the AI receives. Per V9 plan §criteria:
//
//   FULL       — IES uploaded + dimensao confirmed + ≥1 ESG record submitted.
//   PARTIAL    — IES uploaded but no records, OR records but no IES.
//   INCOMPLETE — neither IES nor records; only self-reported size + sector.
//
// The signal that lets the org generate at all is the orgSize self-
// assessment from V3 signup (PRD §22). Without it, even INCOMPLETE
// mode has nothing to anchor on; callers should refuse generation up-
// stream rather than push the decision into the prompt template.
//
// Pure. No I/O. Easy to unit-test.

import type { CompletenessMode } from "../domain/types.js";

export interface CompletenessSignals {
  hasIes: boolean;
  hasDimensao: boolean;
  hasRecords: boolean;
}

export function classifyCompleteness(signals: CompletenessSignals): CompletenessMode {
  const iesAndDimensao = signals.hasIes && signals.hasDimensao;
  if (iesAndDimensao && signals.hasRecords) return "FULL";
  if (iesAndDimensao || signals.hasRecords) return "PARTIAL";
  // Either side alone (IES without dimensao, dimensao without IES) is
  // still PARTIAL — dimensao without the underlying profile is a thin
  // signal but it's better than INCOMPLETE for prompt steering.
  if (signals.hasIes || signals.hasDimensao) return "PARTIAL";
  return "INCOMPLETE";
}
