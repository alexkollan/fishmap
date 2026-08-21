import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useActiveLocation } from "@/location/useActiveLocation";
import { createSpot, deleteSpot, getAdminSpots, publishSpot, unpublishSpot } from "@/lib/admin/client";

export function SpotsPanel() {
  const { t } = useI18n();
  const { location } = useActiveLocation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "spots"], queryFn: getAdminSpots });
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "spots"] });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    await createSpot({ name, lat: location.lat, lon: location.lon, notes: notes || undefined });
    setName("");
    setNotes("");
    invalidate();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium text-ink">{t.admin.spots.title}</h2>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-ground-raised p-3">
        <p className="text-sm font-medium text-ink">{t.admin.spots.createTitle}</p>
        <p className="text-xs text-ink-muted">
          {location.name} · {location.lat.toFixed(3)}, {location.lon.toFixed(3)}
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.spots.name}
          className="rounded-md border border-white/10 bg-ground px-3 py-2 text-sm text-ink"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.spots.notes}
          className="rounded-md border border-white/10 bg-ground px-3 py-2 text-sm text-ink"
        />
        <button type="submit" className="self-start rounded-md bg-white/10 px-3 py-1.5 text-sm text-ink hover:bg-white/20">
          {t.actions.add}
        </button>
      </form>

      {isLoading && <p className="text-ink-muted">{t.common.loading}</p>}

      <div className="flex flex-col gap-2">
        {data?.map((spot) => (
          <div key={spot.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-ground-raised p-3">
            <div>
              <p className="text-sm text-ink">{spot.name}</p>
              <p className="text-xs text-ink-muted">
                {spot.lat.toFixed(3)}, {spot.lon.toFixed(3)} ·{" "}
                <span className={spot.visibility === "public" ? "text-score-good" : "text-ink-muted"}>
                  {spot.visibility === "public" ? t.admin.spots.visibilityPublic : t.admin.spots.visibilityPrivate}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              {spot.visibility === "private" ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(t.admin.spots.confirmPublish)) {
                      await publishSpot(spot.id);
                      invalidate();
                    }
                  }}
                  className="rounded-md border border-white/10 px-2 py-1 text-xs text-ink hover:bg-white/5"
                >
                  {t.admin.spots.publish}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await unpublishSpot(spot.id);
                    invalidate();
                  }}
                  className="rounded-md border border-white/10 px-2 py-1 text-xs text-ink hover:bg-white/5"
                >
                  {t.admin.spots.unpublish}
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await deleteSpot(spot.id);
                  invalidate();
                }}
                className="rounded-md border border-score-bad/30 px-2 py-1 text-xs text-score-bad hover:bg-score-bad/10"
              >
                {t.actions.delete}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
