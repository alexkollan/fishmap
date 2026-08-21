import { Route, Routes } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import { AnalyticsProvider } from "@/lib/analytics/AnalyticsProvider";
import { AnalyticsTracker } from "@/lib/analytics/AnalyticsTracker";
import { AppShell } from "@/ui/AppShell";
import { TodayPage } from "@/routes/today/TodayPage";
import { MapPage } from "@/routes/map/MapPage";
import { ForecastPage } from "@/routes/forecast/ForecastPage";
import { WindPage } from "@/routes/conditions/WindPage";
import { SeaPage } from "@/routes/conditions/SeaPage";
import { PressurePage } from "@/routes/conditions/PressurePage";
import { SkyPage } from "@/routes/conditions/SkyPage";
import { SunMoonPage } from "@/routes/conditions/SunMoonPage";
import { WindowsPage } from "@/routes/windows/WindowsPage";
import { SpotsPage } from "@/routes/spots/SpotsPage";
import { SettingsPage } from "@/routes/settings/SettingsPage";
import { AdminPage } from "@/routes/admin/AdminPage";

export function App() {
  return (
    <I18nProvider>
      <AnalyticsProvider>
        <AnalyticsTracker />
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
      </AnalyticsProvider>
    </I18nProvider>
  );
}
