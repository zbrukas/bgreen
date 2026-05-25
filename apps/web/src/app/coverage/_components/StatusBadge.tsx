import { Badge } from "@/components/ui/badge";
import {
  type CoverageStatus,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
} from "@/lib/coverage-types";

export function StatusBadge({ status }: { status: CoverageStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
