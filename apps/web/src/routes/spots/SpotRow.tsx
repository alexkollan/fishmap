import type { ActiveLocation } from "@fishmap/types";
import { useModeStore } from "@/lib/mode/store";
import { useConditions } from "@/lib/weather/useConditions";
import { ScoreBadge } from "@/ui/ScoreBadge";

interface SpotRowProps {
  location: ActiveLocation;
  notes?: string | null;
  onSelect: () => void;
  action?: React.ReactNode;
}

// A single spot card with its live score — deliberately its own component
// (not inlined in a .map) since useConditions calls hooks and each row
// needs an independent query.
export function SpotRow({ location, notes, onSelect, action }: SpotRowProps) {
  const mode = useModeStore((s) => s.mode);
  const { bundle } = useConditions(location, mode);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-ground-raised p-3">
      <button type="button" onClick={onSelect} className="flex flex-1 flex-col items-start gap-0.5 text-left">
        <span className="text-sm text-ink">{location.name}</span>
        <span className="text-xs text-ink-muted">
          {location.lat.toFixed(3)}, {location.lon.toFixed(3)}
        </span>
        {notes && <span className="text-xs text-ink-muted">{notes}</span>}
      </button>
      {bundle && <ScoreBadge score={bundle.now.result.score} size="md" />}
      {action}
    </div>
  );
}
