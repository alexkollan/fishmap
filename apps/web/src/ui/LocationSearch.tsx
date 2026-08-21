import { useState } from "react";
import type { ActiveLocation } from "@fishmap/types";
import { useI18n } from "@/lib/i18n";
import { useLocationSearch } from "@/location/useLocationSearch";
import { requestGeolocation } from "@/location/geolocation";
import { trackEvent } from "@/lib/analytics/gtag";

interface LocationSearchProps {
  onSelect: (location: ActiveLocation) => void;
  onClose: () => void;
}

export function LocationSearch({ onSelect, onClose }: LocationSearchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const { results, loading, error } = useLocationSearch(query);

  async function handleUseMyLocation() {
    setLocating(true);
    setLocateError(null);
    try {
      const location = await requestGeolocation();
      trackEvent("select_location", { method: "geolocation" });
      onSelect(location);
      onClose();
    } catch (err) {
      setLocateError(err instanceof Error ? err.message : "Could not get location");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="absolute inset-x-0 top-full z-20 border-b border-white/10 bg-ground-raised px-4 py-3 shadow-lg">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.location.searchPlaceholder}
        className="w-full rounded-md border border-white/10 bg-ground px-3 py-2 text-ink outline-none focus:border-white/30"
      />

      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={locating}
        className="mt-2 w-full rounded-md border border-white/10 px-3 py-2 text-left text-sm text-ink-muted hover:text-ink disabled:opacity-50"
      >
        {locating ? t.location.locating : t.location.useMyLocation}
      </button>
      {locateError && <p className="mt-1 text-xs text-score-bad">{locateError}</p>}

      {loading && <p className="mt-2 text-xs text-ink-muted">{t.common.loading}</p>}
      {error && <p className="mt-2 text-xs text-score-bad">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-2 max-h-64 overflow-y-auto">
          {results.map((result, i) => (
            <li key={`${result.lat},${result.lon},${i}`}>
              <button
                type="button"
                onClick={() => {
                  trackEvent("select_location", { method: "search" });
                  onSelect(result);
                  onClose();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-white/5"
              >
                {result.name}
                <span className="ml-2 text-ink-muted">
                  {result.lat.toFixed(2)}, {result.lon.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
