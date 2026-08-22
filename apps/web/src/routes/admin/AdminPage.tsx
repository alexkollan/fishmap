import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { logout, me } from "@/lib/admin/client";
import { LoginForm } from "./LoginForm";
import { FlagsPanel } from "./FlagsPanel";
import { WeightsPanel } from "./WeightsPanel";
import { SpotsPanel } from "./SpotsPanel";
import { AnnouncementPanel } from "./AnnouncementPanel";
import { StatsPanel } from "./StatsPanel";

type Tab = "flags" | "weights" | "spots" | "announcement" | "stats";

// /admin sits outside AppShell (App.tsx) — no bottom tab bar, no location
// header; it's Alex's tool, not part of the public app surface.
export function AdminPage() {
  const { t } = useI18n();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin", "me"], queryFn: me, retry: false });
  const [tab, setTab] = useState<Tab>("flags");

  if (isLoading) return <div className="p-6 text-ink-muted">{t.common.loading}</div>;

  if (!data?.authenticated) {
    return (
      <div className="min-h-full bg-ground">
        <LoginForm onSuccess={() => refetch()} />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "flags", label: t.admin.tabs.flags },
    { key: "weights", label: t.admin.tabs.weights },
    { key: "spots", label: t.admin.tabs.spots },
    { key: "announcement", label: t.admin.tabs.announcement },
    { key: "stats", label: t.admin.tabs.stats },
  ];

  return (
    <div className="min-h-full bg-ground">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-semibold text-ink">Fishmap — {t.nav.admin}</span>
          <button
            type="button"
            onClick={async () => {
              await logout();
              refetch();
            }}
            className="text-sm text-ink-muted underline decoration-white/20 hover:text-ink"
          >
            {t.actions.logout}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-1 border-b border-white/10 pb-2">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`rounded-md px-3 py-1.5 text-sm ${tab === tb.key ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink"}`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === "flags" && <FlagsPanel />}
        {tab === "weights" && <WeightsPanel />}
        {tab === "spots" && <SpotsPanel />}
        {tab === "announcement" && <AnnouncementPanel />}
        {tab === "stats" && <StatsPanel />}
      </div>
    </div>
  );
}
