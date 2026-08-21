import { usePageViewTracking } from "./usePageViewTracking";

/** Mounted once at the app root so every route is tracked, including /admin
 * which sits outside the shared AppShell layout. */
export function AnalyticsTracker() {
  usePageViewTracking();
  return null;
}
