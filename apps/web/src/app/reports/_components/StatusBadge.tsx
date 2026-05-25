import { Badge } from "@/components/ui/badge";
import {
  type ReportInstanceStatus,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/reports-types";

export function StatusBadge({ status }: { status: ReportInstanceStatus }) {
  return <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>;
}
