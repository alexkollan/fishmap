// v1 coverage is the Greek coastline only (DEV_PLAN.md §1) — times are
// formatted in Athens' zone rather than the viewer's browser timezone so a
// tourist browsing from elsewhere still sees the fishing spot's local hours.
export const DISPLAY_TIME_ZONE = "Europe/Athens";

export function formatLocalTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(locale === "el" ? "el-GR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  });
}

export function formatLocalDay(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "el" ? "el-GR" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  });
}
