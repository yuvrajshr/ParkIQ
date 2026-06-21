/** Relative time as an i18n key + value, so the caller can localise via t(key, {n}). */
export function relativeTime(iso: string): { key: string; n: number } {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return { key: "reports.justNow", n: 0 };
  if (min < 60) return { key: "reports.minAgo", n: min };
  const hr = Math.floor(min / 60);
  if (hr < 24) return { key: "reports.hrAgo", n: hr };
  return { key: "reports.dayAgo", n: Math.floor(hr / 24) };
}

/** Date grouping key for section headers.
 *  Returns an i18n key for "Today"/"Yesterday", or a formatted date string for older dates.
 *  The returned object shape: `{ key?: string; label?: string }`.
 *  - If `key` is set, pass it through `t(key)`.
 *  - If `label` is set, use it directly (formatted date like "Jun 19" or "Jun 15, 2025"). */
export function dateGroup(iso: string): { key?: string; label?: string } {
  const d = new Date(iso);
  const now = new Date();

  // Midnight boundaries in local time
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  if (d >= todayStart) return { key: "reports.dateToday" };
  if (d >= yesterdayStart) return { key: "reports.dateYesterday" };

  // Older — use formatted date. Include year if it differs from the current year.
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) {
    return { label: `${month} ${day}` };
  }
  return { label: `${month} ${day}, ${d.getFullYear()}` };
}
