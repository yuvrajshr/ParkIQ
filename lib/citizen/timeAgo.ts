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
