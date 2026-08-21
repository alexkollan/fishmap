import { useState } from "react";
import type { Mode } from "@fishmap/types";
import { useI18n } from "@/lib/i18n";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useNotificationPrefsStore } from "@/lib/notifications/store";
import { isIOS, isStandalone, pushSupported, subscribeToPush, unsubscribeFromPush, type NotificationPrefs } from "@/lib/push/subscribe";
import { useUserSpotsStore } from "@/spots/userSpotsStore";

const MODES: Mode[] = ["shore", "boat", "spearfishing"];
const LOOKAHEAD_OPTIONS = [12, 24, 48, 168] as const;
const FREQUENCY_OPTIONS: NotificationPrefs["maxFrequency"][] = ["1/day", "1/12h", "1/6h"];
const ALERT_KEYS: NotificationPrefs["alertTypes"][number][] = ["goodWindow", "pressureDrop", "safety"];

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { location } = useActiveLocation();
  const spots = useUserSpotsStore((s) => s.spots);
  const { prefs, setPrefs } = useNotificationPrefsStore();
  const [status, setStatus] = useState<string | null>(null);

  const notificationsBlocked = !pushSupported() ? "notSupported" : isIOS() && !isStandalone() ? "needsInstallIOS" : null;

  async function handleSave() {
    setStatus(null);
    if (prefs.enabled) {
      const result = await subscribeToPush(prefs);
      if (!result.ok) {
        setStatus(result.reason === "denied" ? t.settings.notifications.permissionDenied : t.settings.notifications.notSupported);
        return;
      }
    } else {
      await unsubscribeFromPush();
    }
    setStatus(t.settings.notifications.saved);
  }

  function toggleWatchedLocation(loc: { lat: number; lon: number; name: string }) {
    const exists = prefs.locations.some((l) => l.lat === loc.lat && l.lon === loc.lon);
    if (exists) {
      setPrefs({ locations: prefs.locations.filter((l) => !(l.lat === loc.lat && l.lon === loc.lon)) });
    } else if (prefs.locations.length < 5) {
      setPrefs({ locations: [...prefs.locations, loc] });
    }
  }

  function toggleAlertType(key: NotificationPrefs["alertTypes"][number]) {
    const has = prefs.alertTypes.includes(key);
    setPrefs({ alertTypes: has ? prefs.alertTypes.filter((a) => a !== key) : [...prefs.alertTypes, key] });
  }

  const watchable = [location, ...spots.map((s) => ({ lat: s.lat, lon: s.lon, name: s.name }))];

  return (
    <div className="flex flex-col gap-8 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t.nav.settings}</h1>
      </div>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">{t.settings.language}</p>
        <div className="inline-flex w-fit rounded-lg border border-white/10 bg-ground-raised p-1">
          {(["auto", "en", "el"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setLocale(opt === "auto" ? null : opt)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                (opt === "auto" && !localStorage.getItem("fishmap:locale-override")) || opt === locale
                  ? "bg-white/10 text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {opt === "auto" ? t.settings.languageAuto : opt === "en" ? "English" : "Ελληνικά"}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink">{t.settings.theme}</p>
        <p className="text-sm text-ink-muted">{t.settings.themeDark}</p>
      </section>

      <section className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink">{t.settings.units}</p>
        <p className="text-sm text-ink-muted">{t.settings.unitsMetric}</p>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">{t.settings.dataExport}</p>
        <p className="text-sm text-ink-muted">{t.settings.dataExportHint}</p>
      </section>

      <section className="flex flex-col gap-4 border-t border-white/10 pt-6">
        <p className="text-lg font-medium text-ink">{t.settings.notificationsTitle}</p>

        {notificationsBlocked && <p className="text-sm text-score-mid">{t.settings.notifications[notificationsBlocked]}</p>}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={prefs.enabled}
            onChange={(e) => setPrefs({ enabled: e.target.checked })}
            disabled={Boolean(notificationsBlocked)}
            className="accent-score-good"
          />
          {t.settings.notifications.enabled}
        </label>

        <div>
          <p className="mb-1 text-sm text-ink">{t.settings.notifications.watchedLocations}</p>
          <div className="flex flex-col gap-1">
            {watchable.map((loc) => (
              <label key={`${loc.lat}-${loc.lon}`} className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={prefs.locations.some((l) => l.lat === loc.lat && l.lon === loc.lon)}
                  onChange={() => toggleWatchedLocation(loc)}
                  className="accent-score-good"
                />
                {loc.name}
              </label>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink">
            {t.settings.notifications.threshold}: {prefs.threshold}
          </span>
          <input
            type="range"
            min={50}
            max={95}
            value={prefs.threshold}
            onChange={(e) => setPrefs({ threshold: Number(e.target.value) })}
            className="accent-score-good"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink">{t.settings.notifications.mode}</span>
          <select
            value={prefs.mode}
            onChange={(e) => setPrefs({ mode: e.target.value as Mode })}
            className="rounded-md border border-white/10 bg-ground-raised px-3 py-2 text-ink"
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {t.mode[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink">{t.settings.notifications.lookahead}</span>
          <select
            value={prefs.lookaheadHours}
            onChange={(e) => setPrefs({ lookaheadHours: Number(e.target.value) })}
            className="rounded-md border border-white/10 bg-ground-raised px-3 py-2 text-ink"
          >
            {LOOKAHEAD_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h === 12
                  ? t.settings.notifications.lookaheadOptions.h12
                  : h === 24
                    ? t.settings.notifications.lookaheadOptions.h24
                    : h === 48
                      ? t.settings.notifications.lookaheadOptions.h48
                      : t.settings.notifications.lookaheadOptions.d7}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-1 text-sm text-ink">{t.settings.notifications.quietHours}</p>
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t.settings.notifications.quietFrom}
              <input
                type="time"
                value={prefs.quietStart}
                onChange={(e) => setPrefs({ quietStart: e.target.value })}
                className="rounded-md border border-white/10 bg-ground-raised px-2 py-1 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t.settings.notifications.quietTo}
              <input
                type="time"
                value={prefs.quietEnd}
                onChange={(e) => setPrefs({ quietEnd: e.target.value })}
                className="rounded-md border border-white/10 bg-ground-raised px-2 py-1 text-ink"
              />
            </label>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink">{t.settings.notifications.maxFrequency}</span>
          <select
            value={prefs.maxFrequency}
            onChange={(e) => setPrefs({ maxFrequency: e.target.value as NotificationPrefs["maxFrequency"] })}
            className="rounded-md border border-white/10 bg-ground-raised px-3 py-2 text-ink"
          >
            {FREQUENCY_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f === "1/day"
                  ? t.settings.notifications.frequencyOptions.daily
                  : f === "1/12h"
                    ? t.settings.notifications.frequencyOptions.twicePerDay
                    : t.settings.notifications.frequencyOptions.fourPerDay}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-1 text-sm text-ink">{t.settings.notifications.alertTypes}</p>
          <div className="flex flex-col gap-1">
            {ALERT_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={prefs.alertTypes.includes(key)} onChange={() => toggleAlertType(key)} className="accent-score-good" />
                {key === "goodWindow"
                  ? t.settings.notifications.alertGoodWindow
                  : key === "pressureDrop"
                    ? t.settings.notifications.alertPressureDrop
                    : t.settings.notifications.alertSafety}
              </label>
            ))}
          </div>
        </div>

        <button type="button" onClick={handleSave} className="self-start rounded-md bg-white/10 px-4 py-2 text-sm text-ink hover:bg-white/20">
          {t.settings.notifications.save}
        </button>
        {status && <p className="text-sm text-score-good">{status}</p>}
      </section>
    </div>
  );
}
