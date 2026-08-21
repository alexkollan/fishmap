# Progress log

Purpose: let any Claude Code session (or human) pick up this project cold and know exactly what's built, what's verified, what's mid-flight, and what's blocked — without re-deriving it from git history or re-reading the whole conversation. `CLAUDE.md` explains *how* the codebase works; this file explains *where things stand right now*.

**How to use this file:**
- Read it before starting work on this project in a new session.
- Update it after finishing a meaningful chunk of work (a phase, a feature, a significant fix) — not after every small edit. Keep entries terse; this is a status log, not a diary.
- When a phase from `DEV_PLAN.md` §10 completes, move it from "In progress / next" to "Done", and note anything that deviated from the plan as written.
- "Open items" are things a human needs to act on or decide — don't silently drop them, and don't silently resolve them either without flagging that you did.

---

## Current state (as of 2026-08-21)

**Phase 1 (Skeleton, `DEV_PLAN.md` §10) — done and verified live**, not just typechecked: monorepo scaffold, Fastify health check, full router + app shell (mobile bottom tabs / desktop sidebar) with all §6.2 routes as placeholders, active-location store with URL sync, location search (Nominatim) + geolocation with full fallback chain, i18n (confirmed auto-selects Greek correctly on this machine's `Europe/Athens` timezone), PWA manifest + service worker (confirmed via production build + Playwright: SW registers, zero console errors on every route), Docker Compose for both services.

**Phase 2 (Data spine, `DEV_PLAN.md` §10) — done and verified live** via a real Playwright session against both dev servers (not just typecheck/build): every page shows real Open-Meteo data, real computed scores, zero console errors, mode switch reweights and repaints correctly.

- **Open-Meteo adapter** (`apps/api/src/adapters/`): forecast + marine, both requested with `past_days=2` so the trend factors (pressure 3h/6h, sea-temp 48h) have real history instead of only forward hours. SQLite cache (`better-sqlite3`, WAL) keyed on a 0.25° grid snap, TTL 60 min atmospheric / 3 h marine, stale-while-revalidate on upstream failure. `GET /api/weather?lat=&lon=`.
- **Timezone bug caught and fixed before it shipped:** Open-Meteo's `timezone=auto` returns naive local-time strings with no UTC offset. `new Date(...)` on that string parses as the *runtime's* local time, not the location's — this machine happens to be set to `Europe/Athens`, which would have silently masked the bug in local testing (the production VPS is very likely UTC). Fixed once in `apps/api/src/lib/tz.ts`: every `WeatherHour.time` is now converted to a real UTC ISO instant at the API boundary, before it ever reaches scoring or the browser.
- **Scoring engine** (`packages/scoring`): every §4 factor implemented as a pure function (pressure trend, wind, waves, turbidity, sea temp, light-window × cloud multiplicatively, precipitation, solunar via SunCalc, current, coarse seasonality) plus hard vetoes (thunderstorm, high wind/wave per mode) and per-mode default weight profiles. `structure(seg)` is the only §4.13 term not implemented — it's baked per coastline segment, which doesn't exist until the Phase 4 pipeline runs. 4 unit tests passing (`vitest`). SunCalc-based sun/moon/solunar-window computation (`sun.ts`) is also here, not in `apps/web`, so a future server-side notification cron (Phase 8) gets it for free with zero risk of drifting from what the browser shows.
- **Client scoring is inline, not a worker** — computes every hour of the fetched series client-side using the same `@fishmap/scoring` functions, per `DEV_PLAN.md` §5.6 (`apps/web/src/lib/weather/useConditions.ts`).
- **Pages built:** `/` (Today — score, verdict, top-3 factor breakdown, next good window, sun/moon strip, mode switch), `/forecast` (week sparkline + expandable day cards), `/conditions/{wind,sea,pressure,sky}` (shared `ConditionPageLayout` template — current value → chart → plain-language meaning), `/conditions/sun-moon` (fully offline: SunCalc only, no weather fetch — hand-drawn SVG moon phase, 24h timeline with solunar windows marked, ★ when a major period aligns with twilight).
- **Route-level code splitting for charts**, not just `/map`: uPlot (~24 KB gzipped) is `React.lazy()`-loaded on the 5 chart-using routes only. Main bundle is 83 KB gzipped, well under the 180 KB non-map budget in §5.7.
- **Fishing-mode selector added** (`apps/web/src/lib/mode/store.ts`, persisted Zustand store, defaults to `shore`) — not explicitly called out as a Phase 2 deliverable, but the scoring engine is mode-aware from day one and Today/Forecast/conditions pages need *some* mode to score against before the map's mode switch exists (Phase 3+). The map will read/write this same store.
- **API calls are same-origin** (`/api/...`) in both dev and prod — Vite proxies to `localhost:3001` in dev, nginx proxies to the `api` container in prod (new `location /api/` block in `apps/web/nginx.conf`). Sidesteps CORS entirely rather than juggling a `VITE_API_URL` env var per environment.

**Known scope cuts, flagged rather than silently resolved:**
- **`FactorScore.note` (the "why this score" explanations) is English-only.** Static UI chrome (headings, labels, buttons, score bands, mode names) is fully bilingual via the dictionary as usual; the scoring engine's dynamically-generated explanatory sentences are not run through i18n. Localizing those would mean a translation-key+params system for every note variant — treated as a follow-up, not a Phase 2 blocker.
- **`/conditions/sun-moon` and all chart x-axes hardcode `Europe/Athens`** for display formatting rather than deriving the queried point's actual IANA zone. Reasonable given v1 scope is Greek-coastline-only (`DEV_PLAN.md` §1); revisit if the app's coverage ever expands, since a real fix needs a geo-timezone dataset dependency.
- **Wind scoring has no direction-relative-to-shore component yet** — `windRelative()` takes an optional `aspectDeg` for forward compat, but scores speed alone until the Phase 4 coastline pipeline can supply a segment's facing bearing. Every wind-scored page says so in its copy rather than silently pretending the wind curve is complete.
- **Turbidity (derived water clarity) only uses wave height/period and 24h rainfall** — no river-mouth distance or substrate, both segment-level (Phase 4) attributes.

**Not yet started:** Phase 3 (MapLibre + CARTO Dark Matter, tap-to-select, spot detail sheet).

## Open items (need a human)

- **GA4 real-hit verification is unconfirmed.** Everything up to the point a hit would be sent checks out (script loads with the real ID, consent-mode grant fires, `dataLayer` processes commands correctly) — but automated/headless-browser verification is structurally impossible (Google filters `navigator.webdriver` traffic, silently). The user checked GA4 Realtime once and didn't see themselves; they asked to set this aside for now rather than debug it immediately. Worth another look before considering analytics "confirmed working" — possible causes not yet ruled out: brand-new GA4 property still activating, a data stream config detail, or an ad-blocker/browser extension on the user's side.
- **On this dev machine, Vite's HMR does not reliably pick up edits under `/mnt/c` (WSL2).** File-watch events for the Windows-mounted filesystem are flaky over the 9p/drvfs bridge — a saved edit can silently keep serving the pre-edit transform indefinitely. When verifying a fix live and the browser doesn't reflect a change, don't trust HMR: kill the dev server port and restart it before concluding the fix didn't work. Cost real time twice in this session before being caught.

## Deviations from `DEV_PLAN.md` as written

- Node 24 is in use locally (plan specifies Node 22); `engines` is pinned to `>=22` rather than an exact version, and nothing so far depends on a Node-22-specific behavior.
- `apps/api` ships without a `tsc` build step at all (runs via `tsx` in prod too) — see `CLAUDE.md` Architecture section for why. This is a deviation from the implied "Node 22 + Fastify + TypeScript" stack line reading as "compile then run," not a deviation from anything load-bearing in the plan's actual requirements.
- `apps/api`'s Dockerfile now installs `python3 make g++` in the deps stage — `better-sqlite3` compiles from source on Alpine/musl (no prebuilt binary available), and needs a real toolchain to do it.
