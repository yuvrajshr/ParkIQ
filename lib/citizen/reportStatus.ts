import type { ReportStatus } from "@/lib/types";

/** Pin/chip colour per triage state. New = amber (needs attention), reviewed = blue,
 *  resolved = green, dismissed = faint. Reuses the app's heat/brand tokens. */
export const STATUS_COLOR: Record<ReportStatus, string> = {
  new: "var(--color-accent)",
  reviewed: "var(--color-primary)",
  resolved: "var(--color-heat-low)",
  dismissed: "var(--color-faint)",
};

export const STATUS_I18N: Record<ReportStatus, string> = {
  new: "reports.status.new",
  reviewed: "reports.status.reviewed",
  resolved: "reports.status.resolved",
  dismissed: "reports.status.dismissed",
};

export const REPORT_STATUSES: ReportStatus[] = ["new", "reviewed", "resolved", "dismissed"];
