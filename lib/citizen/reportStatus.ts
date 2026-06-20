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

/** Forward-only triage pipeline: new → reviewed → resolved. The controller can only advance a
 *  report, never move it backward. `dismissed` is a terminal side-exit and has no rank. */
export const STATUS_RANK: Record<"new" | "reviewed" | "resolved", number> = {
  new: 0,
  reviewed: 1,
  resolved: 2,
};

/** Resolved and dismissed are final — no further status changes or dispatch are allowed. */
export function isTerminalStatus(status: ReportStatus): boolean {
  return status === "resolved" || status === "dismissed";
}

/** True only when `next` is a strictly-forward move from `current`, or a dismissal.
 *  Used to reject illegal/stale transitions on both the buttons and the optimistic update. */
export function canTransition(current: ReportStatus, next: ReportStatus): boolean {
  if (isTerminalStatus(current)) return false;
  if (next === "dismissed") return true;
  if (next === "new") return false; // never reopen
  return STATUS_RANK[next] > STATUS_RANK[current as "new" | "reviewed"];
}
