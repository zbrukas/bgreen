export { recordTemplatesRoutes } from "./api/routes.js";
export { RecordTemplateService } from "./application/record-template-service.js";
export type {
  CreateRecordTemplateInput,
  RecordTemplateRepository,
  UpdateRecordTemplateInput,
} from "./application/record-template-service.js";
export { DrizzleRecordTemplateRepository } from "./infrastructure/record-template-repository.js";
export {
  FormSchemaSchema,
  type FormSchema,
  type RecordTemplate,
  type RecordTemplateStatus,
  RecordTemplateSchema,
  RecordTemplateStatusSchema,
} from "./domain/record-template.js";
