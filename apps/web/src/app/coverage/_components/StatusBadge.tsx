import {
  type CoverageStatus,
  STATUS_LABEL,
  STATUS_TAG_TYPE,
} from "@/lib/coverage-types";
import { Tag } from "@carbon/react";

export function StatusBadge({ status }: { status: CoverageStatus }) {
  return <Tag type={STATUS_TAG_TYPE[status]}>{STATUS_LABEL[status]}</Tag>;
}
