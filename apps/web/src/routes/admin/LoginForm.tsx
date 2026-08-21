import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { login } from "@/lib/admin/client";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
      onSuccess();
    } catch {
      setError(t.admin.loginError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-sm flex-col gap-3 px-4 py-10">
      <h1 className="text-xl font-semibold text-ink">{t.admin.loginTitle}</h1>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        {t.admin.passwordLabel}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-white/10 bg-ground-raised px-3 py-2 text-ink"
          autoFocus
        />
      </label>
      {error && <p className="text-sm text-score-bad">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="rounded-md bg-white/10 px-3 py-2 text-sm text-ink hover:bg-white/20 disabled:opacity-50"
      >
        {t.admin.loginSubmit}
      </button>
    </form>
  );
}
