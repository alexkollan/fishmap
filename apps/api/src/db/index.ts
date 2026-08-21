import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const db: Database.Database = new Database(path.join(dataDir, "fishmap.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS weather_cache (
    grid_lat REAL NOT NULL,
    grid_lon REAL NOT NULL,
    variable_set TEXT NOT NULL,
    payload TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (grid_lat, grid_lon, variable_set)
  );

  -- DEV_PLAN.md §6.7: admin-owned spots, private by default. Public reads
  -- filter on visibility in SQL (apps/api/src/routes/spots.ts), never in
  -- application code, so a later refactor can't accidentally leak rows.
  CREATE TABLE IF NOT EXISTS spots (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    lat         REAL NOT NULL,
    lon         REAL NOT NULL,
    notes       TEXT,
    visibility  TEXT NOT NULL DEFAULT 'private'
                CHECK(visibility IN ('private','public')),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  -- DEV_PLAN.md §8: feature flags, admin-editable.
  CREATE TABLE IF NOT EXISTS feature_flags (
    key         TEXT PRIMARY KEY,
    description TEXT,
    state       TEXT NOT NULL CHECK(state IN ('off','admin_only','rollout','on')),
    rollout_pct INTEGER DEFAULT 0,
    updated_at  INTEGER NOT NULL
  );

  -- DEV_PLAN.md §7.4: Web Push subscriptions with per-subscription prefs,
  -- since iOS gives us no client-side scheduling — the cron evaluates
  -- these directly.
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              INTEGER PRIMARY KEY,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 0,
    locations       TEXT NOT NULL DEFAULT '[]',
    threshold       INTEGER NOT NULL DEFAULT 80,
    mode            TEXT NOT NULL DEFAULT 'shore',
    lookahead_hours INTEGER NOT NULL DEFAULT 24,
    quiet_start     TEXT NOT NULL DEFAULT '23:00',
    quiet_end       TEXT NOT NULL DEFAULT '06:00',
    max_frequency   TEXT NOT NULL DEFAULT '1/12h',
    alert_types     TEXT NOT NULL DEFAULT '["goodWindow","safety"]',
    last_sent_at    INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  );

  -- DEV_PLAN.md §8: live weight editor overrides, per mode. Absent mode
  -- rows fall back to packages/scoring's DEFAULT_WEIGHT_PROFILES.
  CREATE TABLE IF NOT EXISTS weight_overrides (
    mode        TEXT PRIMARY KEY CHECK(mode IN ('shore','boat','spearfishing')),
    weights     TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  -- DEV_PLAN.md §8: single-row global announcement banner.
  CREATE TABLE IF NOT EXISTS announcement (
    id        INTEGER PRIMARY KEY CHECK(id = 1),
    message   TEXT,
    active    INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

const seedFlag = db.prepare(
  `INSERT INTO feature_flags (key, description, state, rollout_pct, updated_at)
   VALUES (@key, @description, @state, 0, @now)
   ON CONFLICT(key) DO NOTHING`,
);
seedFlag.run({
  key: "windParticles",
  description: "Animated wind particle overlay on the map — unproven frame cost, admin-only until measured (DEV_PLAN.md §6.6).",
  state: "admin_only",
  now: Date.now(),
});
