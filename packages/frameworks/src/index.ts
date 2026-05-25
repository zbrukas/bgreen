// Public exports for the @bgreen/frameworks package. Aggregates the
// three framework catalogs into a single `ALL_FRAMEWORK_DATAPOINTS`
// constant — the apps/api seed script reads this and writes one row
// per entry into the `framework_datapoints` table.

import { ESRS_E1_DATAPOINTS } from "./esrs-e1.js";
import { GHG_PROTOCOL_DATAPOINTS } from "./ghg-protocol.js";
import { GRI_DATAPOINTS } from "./gri.js";
import type { FrameworkDatapoint } from "./types.js";

export { ESRS_E1_DATAPOINTS } from "./esrs-e1.js";
export { GHG_PROTOCOL_DATAPOINTS } from "./ghg-protocol.js";
export { GRI_DATAPOINTS } from "./gri.js";
export {
  type Framework,
  type FrameworkDatapoint,
  type SectorApplicability,
  evaluateSectorApplicability,
} from "./types.js";

export const ALL_FRAMEWORK_DATAPOINTS: readonly FrameworkDatapoint[] = [
  ...ESRS_E1_DATAPOINTS,
  ...GHG_PROTOCOL_DATAPOINTS,
  ...GRI_DATAPOINTS,
];
