import { useMemo } from "react";
import type { ActiveLocation } from "@fishmap/types";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";
import { renderFactorNote } from "@/lib/i18n/renderFactorNote";
import { useUserSpotsStore } from "@/spots/userSpotsStore";
import { useBestWindows } from "@/lib/weather/useBestWindows";
import { formatLocalDay, formatLocalTime } from "@/lib/formatTime";
import { ScoreBadge } from "@/ui/ScoreBadge";
import { ModeSwitch } from "@/ui/ModeSwitch";

export function WindowsPage() {
  const { t, locale } = useI18n();
  const { location } = useActiveLocation();
  const mode = useModeStore((s) => s.mode);
  const userSpots = useUserSpotsStore((s) => s.spots);

  const locations = useMemo<ActiveLocation[]>(() => {
    const list: ActiveLocation[] = [location];
    for (const spot of userSpots) {
      if (!list.some((l) => l.lat === spot.lat && l.lon === spot.lon)) {
        list.push({ lat: spot.lat, lon: spot.lon, name: spot.name });
      }
    }
    return list;
  }, [location, userSpots]);

  const { windows, isLoading } = useBestWindows(locations, mode);

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t.windows.title}</h1>
        <p className="text-sm text-ink-muted">{t.windows.subtitle}</p>
      </div>

      <ModeSwitch />

      {userSpots.length === 0 && <p className="text-xs text-ink-muted">{t.windows.noSavedLocations}</p>}

      {isLoading && <p className="text-sm text-ink-muted">{t.common.loading}</p>}

      {!isLoading && windows.length === 0 && <p className="text-sm text-ink-muted">{t.windows.empty}</p>}

      <div className="flex flex-col gap-2">
        {windows.map((w, i) => (
          <div key={`${w.location.lat}-${w.location.lon}-${w.time}`} className="flex items-center gap-3 rounded-lg border border-white/10 bg-ground-raised p-3">
            <span className="font-tabular text-sm text-ink-muted">{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm text-ink">{w.location.name}</p>
              <p className="font-tabular text-sm text-ink">
                {formatLocalDay(w.time, locale)} · {formatLocalTime(w.time, locale)}
              </p>
              {w.topFactor && <p className="text-xs text-ink-muted">{renderFactorNote(t, w.topFactor)}</p>}
            </div>
            <ScoreBadge score={w.score} size="md" />
          </div>
        ))}
      </div>
    </div>
  );
}
