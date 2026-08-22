import { useState } from "react";
import { useActiveLocation } from "@/location/useActiveLocation";
import { useI18n } from "@/lib/i18n";
import { LocationSearch } from "./LocationSearch";

export function Header() {
  const { location, setLocation } = useActiveLocation();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="relative border-b border-white/10 bg-ground px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <span className="font-semibold text-ink">Fishmap</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-ink hover:bg-white/5"
          aria-label={t.location.changeLocation}
        >
          <span>{location.name || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`}</span>
          <span className="text-ink-muted">▾</span>
        </button>
      </div>
      {open && (
        <LocationSearch onSelect={setLocation} onClose={() => setOpen(false)} />
      )}
    </header>
  );
}
