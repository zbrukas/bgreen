import {
  type ReportInstanceStatus,
  STATUS_LABEL,
  STATUS_TAG_TYPE,
} from "@/lib/reports-types";
import { Tag } from "@carbon/react";

export function StatusBadge({ status }: { status: ReportInstanceStatus }) {
  return <Tag type={STATUS_TAG_TYPE[status]}>{STATUS_LABEL[status]}</Tag>;
}
