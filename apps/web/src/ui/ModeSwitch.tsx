import type { Mode } from "@fishmap/types";
import { useModeStore } from "@/lib/mode/store";
import { useI18n } from "@/lib/i18n";

const MODES: Mode[] = ["shore", "boat", "spearfishing"];

export function ModeSwitch() {
  const { t } = useI18n();
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);

  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-ground-raised p-1">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            m === mode ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink"
          }`}
          aria-pressed={m === mode}
        >
          {t.mode[m]}
        </button>
      ))}
    </div>
  );
}
