import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { getAnnouncement, setAnnouncement } from "@/lib/admin/client";

export function AnnouncementPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "announcement"], queryFn: getAnnouncement });
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (data) {
      setMessage(data.message ?? "");
      setActive(Boolean(data.active));
    }
  }, [data]);

  async function save() {
    await setAnnouncement(message, active);
    qc.invalidateQueries({ queryKey: ["admin", "announcement"] });
    qc.invalidateQueries({ queryKey: ["announcement"] });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-medium text-ink">{t.admin.announcement.title}</h2>
        <p className="text-sm text-ink-muted">{t.admin.announcement.description}</p>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder={t.admin.announcement.message}
        className="rounded-md border border-white/10 bg-ground-raised px-3 py-2 text-sm text-ink"
      />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-score-good" />
        {t.admin.announcement.active}
      </label>
      <button type="button" onClick={save} className="self-start rounded-md bg-white/10 px-3 py-2 text-sm text-ink hover:bg-white/20">
        {t.actions.save}
      </button>
    </div>
  );
}
