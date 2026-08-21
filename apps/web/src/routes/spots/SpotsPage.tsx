import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useUserSpotsStore, type UserSpot } from "@/spots/userSpotsStore";
import { SpotRow } from "./SpotRow";

interface PublicSpot {
  id: number;
  name: string;
  lat: number;
  lon: number;
  notes: string | null;
}

async function fetchPublicSpots(): Promise<PublicSpot[]> {
  const res = await fetch("/api/spots");
  if (!res.ok) throw new Error(`Failed to load spots: ${res.status}`);
  return res.json() as Promise<PublicSpot[]>;
}

export function SpotsPage() {
  const { t } = useI18n();
  const { location, setLocation } = useActiveLocation();
  const spots = useUserSpotsStore((s) => s.spots);
  const addSpot = useUserSpotsStore((s) => s.addSpot);
  const removeSpot = useUserSpotsStore((s) => s.removeSpot);
  const replaceAll = useUserSpotsStore((s) => s.replaceAll);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: publicSpots } = useQuery({ queryKey: ["spots", "public"], queryFn: fetchPublicSpots, staleTime: 5 * 60_000 });

  function handleExport() {
    const blob = new Blob([JSON.stringify(spots, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fishmap-spots.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text) as UserSpot[];
      const existingIds = new Set(spots.map((s) => s.id));
      const merged = [...spots, ...imported.filter((s) => !existingIds.has(s.id))];
      replaceAll(merged);
    } catch {
      // Malformed file — silently ignore rather than throw in the user's face.
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-8 px-4 py-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">{t.spots.userTitle}</h1>
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={handleExport} className="text-ink-muted underline decoration-white/20 hover:text-ink">
              {t.spots.exportSpots}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-ink-muted underline decoration-white/20 hover:text-ink">
              {t.spots.importSpots}
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => addSpot({ name: location.name, lat: location.lat, lon: location.lon })}
          className="mb-3 w-full rounded-md border border-white/10 px-3 py-2 text-sm text-ink hover:bg-white/5"
        >
          {t.spots.addCurrentLocation}
        </button>

        {spots.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.spots.userEmpty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {spots.map((spot) => (
              <SpotRow
                key={spot.id}
                location={spot}
                notes={spot.notes}
                onSelect={() => setLocation({ lat: spot.lat, lon: spot.lon, name: spot.name })}
                action={
                  <button
                    type="button"
                    onClick={() => removeSpot(spot.id)}
                    className="rounded-md border border-score-bad/30 px-2 py-1 text-xs text-score-bad hover:bg-score-bad/10"
                  >
                    {t.spots.remove}
                  </button>
                }
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold text-ink">{t.spots.publicTitle}</h2>
        {!publicSpots || publicSpots.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.spots.publicEmpty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {publicSpots.map((spot) => (
              <SpotRow
                key={spot.id}
                location={{ lat: spot.lat, lon: spot.lon, name: spot.name }}
                notes={spot.notes}
                onSelect={() => setLocation({ lat: spot.lat, lon: spot.lon, name: spot.name })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
