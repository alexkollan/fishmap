# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

1. Read `DEV_PLAN.md` — the full product/architecture spec (scoring engine, data sources, feature set, build order). It is the source of truth for *what this app is*.
2. Read `PROGRESS.md` — the running log of *where development actually is right now*: what's built and verified, what deviates from the plan, what's blocked, what's next. Update it whenever you complete a meaningful chunk of work, not after every file edit.
3. `DEV_PLAN.md`'s phases (§10) are a roadmap, not a cage. If the user asks for something out of sequence or outside the plan (as happened with the Docker port and Google Analytics — see `PROGRESS.md`), do that thing. Don't block on "but Phase 2 hasn't started yet."

## Git workflow — read before touching git

**Claude commits locally. Claude never pushes.** The user pushes to GitHub themselves. Do not run `git push` under any circumstances unless the user explicitly asks for that specific action in that specific message.

Commits require a configured git identity (`git config --global user.name` / `user.email`) on this machine — check before assuming a commit will succeed.

## Commands

Package manager is pnpm (workspaces). Node >=22 required.

```
pnpm install                         # install all workspace deps

pnpm dev:web                         # apps/web dev server (Vite, :5173)
pnpm dev:api                         # apps/api dev server (tsx watch, :3001)

pnpm typecheck                       # tsc --noEmit across all 4 packages
pnpm build                           # production build of apps/web only (apps/api has no build step — see Architecture)
pnpm test                            # vitest run across all packages (packages/scoring + apps/api have real tests now)

docker compose build                 # build api + web images
docker compose up -d                 # run the stack locally (web on :48181, api on :3001)
docker compose down

node tools/coastline-pipeline/build.mjs   # regenerate apps/web/public/data/coastline.geojson — needs raw Natural
                                           # Earth GeoJSON in a scratch dir first, see the Coastline data section below
```

Single-package variants: `pnpm --filter @fishmap/web <script>`, `pnpm --filter @fishmap/api <script>`, etc. (package names: `@fishmap/web`, `@fishmap/api`, `@fishmap/types`, `@fishmap/scoring`).

Once test files exist: `pnpm --filter <package> exec vitest run <path>` for a single file, or `-t "<name>"` for a single test.

## Architecture

### Monorepo layout

- `apps/web` — React 18 + Vite + TypeScript (strict), the PWA.
- `apps/api` — Fastify, Node.
- `packages/types`, `packages/scoring` — shared code, imported by both apps.
- `tools/coastline-pipeline` — one-off build script (Natural Earth → segmented GeoJSON with per-segment aspect). Real workspace member now (`pnpm-workspace.yaml` has `tools/*`). See "Coastline data" below — this is *not* the OSM+tippecanoe MVT pipeline `DEV_PLAN.md` §5.1/Phase 4 describes.

### `packages/types` and `packages/scoring` have no build step — this is load-bearing

Both packages' `main`/`types` fields point straight at `src/index.ts` — raw TypeScript, never compiled. This works because:
- **Vite** (`apps/web`) transpiles per-file with esbuild regardless of what a workspace package's `main` points to, so it handles raw `.ts` from a linked package transparently.
- **`apps/api` runs via `tsx`, in both dev *and production*** (`"start": "tsx src/server.ts"`, not `node dist/server.js`). This was a deliberate fix: a `tsc`-compiled API run with plain `node` would crash the moment it imports `@fishmap/scoring` or `@fishmap/types`, because Node can't execute a bare `.ts` file. Do not "fix" the API to build-then-run-with-node without first giving these two packages a real compile step — it will break at runtime, not at typecheck (typecheck passes fine either way, since TS resolves workspace packages via source regardless).

If either package ever needs a real build step (e.g. to ship a compiled artifact outside this monorepo), add `tsc` build scripts and repoint `main`/`types` at `dist/` — but that also means giving `apps/api`'s Dockerfile back a compile stage.

### Location is the app's spine, not the map

`apps/web/src/location/useActiveLocation.ts` is the single source of truth for "where is the app currently looking." URL search params (`?lat=&lon=&name=`) win on read; the Zustand store (persisted to localStorage) is the fallback when a route has none yet, and gets synced back into the URL. Every page calls this hook and never touches `searchParams` or the store directly. `DEV_PLAN.md` §6.1 is explicit that the map must never own this state — build order intentionally puts the location store before the map for this reason.

### Route-level code splitting for `/map`

Per `DEV_PLAN.md` §5.6, `/map` is the only route that pays for MapLibre's weight — `App.tsx` loads `MapPage` via `React.lazy()`, same as the chart-using routes. Don't let anything under `apps/web/src/map/` get imported from a non-map route (that includes `useWeightProfiles`, which is fine — it's tiny and used everywhere — but not the MapLibre/worker code itself).

### Coastline data — Natural Earth + GeoJSON, not OSM + tippecanoe

`DEV_PLAN.md` §5.1/§10 Phase 4 specs an OSM extract → tippecanoe → MVT vector tile pipeline. **That's not what's built.** `tippecanoe` isn't installable in the environment this was built in (no sudo, not in the apt mirror without one; no `gdal`/`ogr2ogr` either as a fallback). Instead, `tools/coastline-pipeline/build.mjs`:

1. Reads two pre-fetched GeoJSON files (Natural Earth 10m `ne_10m_coastline`/`ne_10m_land`, pulled from a GitHub mirror — the script does *not* fetch them itself, see the comments for the URLs) from a scratch directory.
2. Clips to the Greek bbox, chunks into ~1.5 km segments via `@turf/turf`'s `lineChunk`.
3. Computes each segment's seaward `aspectDeg` (bearing the segment faces the sea) by testing which perpendicular-to-the-segment direction lands in a land polygon.
4. Also bakes each segment's nearest 0.25° `gridLat`/`gridLon` (matching `apps/api/src/lib/grid.ts`'s snap) directly onto its properties, so the client never has to compute that mapping.
5. Writes `apps/web/public/data/coastline.geojson` — 8,965 features, ~430 KB gzipped.

The map loads this as a single MapLibre GeoJSON source (`promoteId: "id"`) and recolors it entirely via `setFeatureState`, no vector tiles. This works and performs fine at the scale tested, but is lower-fidelity than real MVT tiles: coarser segments, no zoom-dependent level-of-detail (§5.3's LOD table isn't implemented — the same segment density renders at every zoom). If tippecanoe/gdal ever become available in the build environment, the real pipeline from §5.1 is the thing to build; don't treat this GeoJSON approach as the intended final state.

### Map scoring pipeline (`apps/web/src/map/`)

- `useCoastlineScoring.ts` owns the whole thing: loads the coastline once, tracks which 0.25° grid cells have been fetched, fetches only new cells intersecting the current (padded) viewport on `moveend`, feeds a Web Worker.
- `scoring.worker.ts` is the only place in the app that scores more than one point at a time. It scores every segment × the current hour on `hourIndex`/`mode` change, and separately computes a sampled (≤150 segments) whole-week average for the scrubber's sparkline. It returns **every factor's score per segment**, not just the overall — switching the layer drawer's score-layer view is instant and needs no second worker round-trip.
- Weather batching: `GET /api/weather/grid?points=lat,lon;lat,lon;...` (max 120 points/request server-side; the client chunks at 100 and fetches chunks in parallel). Scoring uses **nearest-grid-cell**, not the bilinear interpolation `DEV_PLAN.md` §5.2 describes — each segment's grid cell is baked in at pipeline build time and looked up directly. Simpler than bilinear; revisit if scores look blocky near grid-cell boundaries.
- Wind scoring is aspect-relative **only on the map** (`windRelative()` in `packages/scoring` takes an `aspectDeg` param). Single-point pages have no coastline segment to source an aspect from and still score wind by speed alone — this is the plan's intended architecture, not a bug.
- Resolved weight profiles (admin overrides, see below) reach the worker via a `"weights"` message posted whenever `useWeightProfiles()` resolves/changes.

### Admin, feature flags, and the live weight editor

`apps/api/src/lib/auth.ts` + `routes/admin.ts`: one hardcoded admin via `ADMIN_PASSWORD_HASH` (argon2id) → JWT in an httpOnly cookie. `/admin` sits outside `AppShell` in `App.tsx` (no bottom tabs, no location header — it's not part of the public app surface).

**The live weight editor is genuinely live, app-wide, not just an admin preview.** `weight_overrides` rows (per mode) are merged with `DEFAULT_WEIGHT_PROFILES` behind a *public* `GET /api/weights`, and `apps/web/src/lib/weightProfiles.ts`'s `useWeightProfiles()` is what `useConditions`, the map worker, and `useBestWindows` actually score against — none of them import `DEFAULT_WEIGHT_PROFILES` directly for scoring anymore (packages/scoring still exports it as the fallback). If you add a new place that calls `scoreHour`, route its weight profile through `useWeightProfiles()`, not the static default, or an admin's edit silently won't apply there.

Feature flags (`feature_flags` table, `GET /api/flags`, `useFlag()`) exist and work; only one flag (`windParticles`) is seeded, and nothing is actually gated behind it yet — no particle animation was built this session.

### Translated factor notes — `noteKey`/`noteParams`, not raw strings

`FactorScore.note` (in `packages/types`) is an **English-only fallback for non-UI consumers** (currently just the notification cron, which has no i18n layer). The UI never renders it directly. Every scoring factor (`packages/scoring/src/factors.ts`) and veto (`vetoes.ts`) also returns a `noteKey`/`noteParams` (or `VetoInfo.key`/`params`) — a translation key into `Dictionary.factorNotes`/`Dictionary.vetoes` plus interpolation values. `apps/web/src/lib/i18n/renderFactorNote.ts` does the lookup + `{param}` interpolation (two reserved param names, `phaseKey` and `monthKey`, get re-translated via `t.sunMoon.phase`/`t.common.months` instead of interpolated raw). Every UI surface that shows a factor's reasoning (`FactorBreakdown`, `TodayPage`, condition pages, the map's `SpotSheet`, `WindowsPage`) renders through this. If you add a new factor or veto branch, add both the English `note` (fallback) and a `noteKey`/params — a UI that falls back to `.note` for a new branch will silently show English regardless of locale, since `renderFactorNote`'s fallback-to-English is a deliberate "never blank" safety net, not a translation.

### PWA service worker — `injectManifest`, not `generateSW`

`vite-plugin-pwa` is configured with `strategies: "injectManifest"` and a custom source (`apps/web/src/sw.ts`), not the default `generateSW`. This is required, not a style choice: Web Push (`DEV_PLAN.md` §7.4) needs the service worker to call `showNotification()` in a `push` event listener, and the stock `generateSW` service worker has no such listener — a push payload it doesn't handle is silently dropped by the browser, no error anywhere. `sw.ts` adds `push` and `notificationclick` handlers alongside the standard `precacheAndRoute`. It's excluded from `apps/web/tsconfig.json`'s `include` (see the `exclude` entry) because `ServiceWorkerGlobalScope`/`PushEvent`/etc. aren't part of the DOM lib the rest of the app compiles against, and mixing DOM + WebWorker libs in one tsconfig causes global type conflicts — this doesn't affect the actual build, since vite-plugin-pwa bundles `sw.ts` independently via its own esbuild pass regardless of the app's tsconfig.

### Local dev credentials — `apps/api/.env`

Admin login, JWT signing, and Web Push all need env vars (`ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) that `.env.example` always anticipated but nothing previously generated. `apps/api/.env` (gitignored) now has real dev values — dev admin password is `fishmap-dev-admin`. `apps/api/src/env.ts` is imported first (side-effect only, before `app.js`) in `server.ts` so `process.loadEnvFile()` runs before anything reads `process.env` — plain top-level code in `server.ts` before the `app.js` import would *not* work, since ESM hoists all `import` statements ahead of other top-level statements regardless of source order. **Treat the values in this `.env` as burned** before any real deployment — generate fresh ones rather than reusing what a coding session produced.

### i18n

Hand-rolled dictionary (`apps/web/src/lib/i18n/`), not a library — string count is low enough that this is defensible per `DEV_PLAN.md` §7.5. Locale resolution order (first hit wins): manual override (localStorage) → geolocation-if-already-granted (Greece bbox) → `Intl` timezone === `Europe/Athens` → `navigator.languages` contains `el` → English fallback. Never requests geolocation permission just to pick a language.

### Analytics (Google Analytics 4)

`apps/web/src/lib/analytics/`. Two non-obvious things future changes need to respect:

- **Consent Mode v2 grant is required, separately from loading the script.** Loading `gtag.js` is not enough — Google's runtime defaults new tags to a "denied" consent state and will silently withhold hits (no `/g/collect` request, no `_ga` cookie) even though `dataLayer` processes your `config`/`event` pushes and internal lifecycle events fire normally. `loadAnalytics()` in `gtag.ts` sends an explicit `gtag('consent', 'default', {...granted})` — it does this because it's only ever called after the app's own consent banner has already been accepted, so that's accurate, not a compliance bypass.
- **Vite inlines `VITE_*` vars at build time, not runtime.** For local dev, `apps/web/.env` (gitignored). For Docker, the value must come in as a build `ARG` (see `apps/web/Dockerfile` and the `args:` block in `docker-compose.yml`) sourced from the *root* `.env` (also gitignored) — a container-level `environment:` entry would have no effect on the already-built bundle.
- The consent banner gates script loading entirely (GDPR: the EU/Greek-facing app must not load the tracking script pre-consent, not just withhold events). `page_view` firing is debounced 150ms in `usePageViewTracking.ts` because `useActiveLocation` syncs `lat`/`lon`/`name` into the URL a render after navigation — without the debounce, every route change fires two `page_view` events instead of one.
- Verifying real hits land in GA4 cannot be done with an automated/headless browser: Google's tag runtime detects `navigator.webdriver === true` and filters the traffic as a bot, silently (script still loads, `dataLayer` still processes, no hit is ever sent). If you need to confirm hits fire, it has to be a real interactive browser session.

### Docker / deployment

`docker-compose.yml` runs two services: `api` (Fastify, port 3001) and `web` (nginx serving the Vite production build, host port **48181** — chosen to match the Cloudflare Tunnel target on the OVH VPS, see `PROGRESS.md`). `web` is deliberately *not* gated on `api`'s healthcheck via `depends_on: condition: service_healthy` — do not add that back. It was tried and reverted because Docker Desktop's WSL2 bridge network can take well over a minute to become reachable on a freshly created network (an artifact of the local dev machine, not the app), which made local `docker compose up` unreliable. The healthcheck itself is still defined and useful for monitoring/orchestration on the actual Linux deployment target, which won't hit this.
