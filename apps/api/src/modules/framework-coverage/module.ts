export {
  type CalculateCoverageInput,
  type CalculatorRecord,
  calculateCoverage,
} from "./application/coverage-calculator.js";
export {
  CoverageService,
  type CoverageCheckResult,
  type CoverageQuery,
  type MappingError,
  type MappingResult,
  type RowExplanation,
} from "./application/coverage-service.js";
export {
  type CheckFrameworkCoverageInput,
  type CheckFrameworkCoverageOutput,
  checkFrameworkCoverageInputSchema,
  checkFrameworkCoverageOutputSchema,
  checkFrameworkCoverageTool,
} from "./application/tools/check-framework-coverage-tool.js";
export type {
  CoverageMatrix,
  CoverageRow,
  CoverageStatus,
  TemplateDatapointMapping,
} from "./domain/types.js";
export {
  DrizzleFrameworkDatapointRepository,
  type FrameworkDatapointRepository,
} from "./infrastructure/framework-datapoint-repository.js";
export {
  DrizzleTemplateDatapointMappingRepository,
  type TemplateDatapointMappingRepository,
} from "./infrastructure/template-datapoint-mapping-repository.js";
export {
  frameworkCoverageRoutes,
  frameworkDatapointsRoutes,
  templateDatapointMappingsRoutes,
} from "./api/routes.js";
