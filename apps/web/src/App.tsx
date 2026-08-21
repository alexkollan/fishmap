import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AnalyticsProvider } from "@/lib/analytics/AnalyticsProvider";
import { AnalyticsTracker } from "@/lib/analytics/AnalyticsTracker";
import { AppShell } from "@/ui/AppShell";
import { TodayPage } from "@/routes/today/TodayPage";
import { SunMoonPage } from "@/routes/conditions/SunMoonPage";
import { WindowsPage } from "@/routes/windows/WindowsPage";
import { SpotsPage } from "@/routes/spots/SpotsPage";
import { SettingsPage } from "@/routes/settings/SettingsPage";
import { AdminPage } from "@/routes/admin/AdminPage";

// MapLibre is by far the heaviest dependency in the app — /map is the only
// route that pays for it (DEV_PLAN.md §5.6).
const MapPage = lazy(() => import("@/routes/map/MapPage").then((m) => ({ default: m.MapPage })));

// Charting (uPlot) is only pulled in by these routes — lazy so /  and other
// non-charting pages stay near-instant (DEV_PLAN.md §5.6).
const ForecastPage = lazy(() => import("@/routes/forecast/ForecastPage").then((m) => ({ default: m.ForecastPage })));
const WindPage = lazy(() => import("@/routes/conditions/WindPage").then((m) => ({ default: m.WindPage })));
const SeaPage = lazy(() => import("@/routes/conditions/SeaPage").then((m) => ({ default: m.SeaPage })));
const PressurePage = lazy(() => import("@/routes/conditions/PressurePage").then((m) => ({ default: m.PressurePage })));
const SkyPage = lazy(() => import("@/routes/conditions/SkyPage").then((m) => ({ default: m.SkyPage })));

function LazyPageFallback() {
  const { t } = useI18n();
  return <div className="px-4 py-6 text-ink-muted">{t.common.loading}</div>;
}

export function App() {
  return (
    <I18nProvider>
      <AnalyticsProvider>
        <AnalyticsTracker />
        <Suspense fallback={<LazyPageFallback />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<TodayPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/forecast" element={<ForecastPage />} />
              <Route path="/conditions/wind" element={<WindPage />} />
              <Route path="/conditions/sea" element={<SeaPage />} />
              <Route path="/conditions/pressure" element={<PressurePage />} />
              <Route path="/conditions/sky" element={<SkyPage />} />
              <Route path="/conditions/sun-moon" element={<SunMoonPage />} />
              <Route path="/windows" element={<WindowsPage />} />
              <Route path="/spots" element={<SpotsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Suspense>
      </AnalyticsProvider>
    </I18nProvider>
  );
}
