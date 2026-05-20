export { recordsRoutes } from "./api/routes.js";
export { RecordService } from "./application/record-service.js";
export type {
  CreateRecordInput,
  RecordRepository,
  ReviewDecision,
  ReviewRecordInput,
  ReviewResult,
  SubmitResult,
  UpdateRecordInput,
  UpdateResult,
} from "./application/record-service.js";
export { DrizzleRecordRepository } from "./infrastructure/record-repository.js";
export {
  type Record,
  type RecordStatus,
  RecordSchema,
  RecordStatusSchema,
  type RecordValues,
} from "./domain/record.js";
