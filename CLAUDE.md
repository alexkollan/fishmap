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
pnpm test                            # vitest run across all packages — NOTE: no test files exist yet, this will currently report "no tests found"

docker compose build                 # build api + web images
docker compose up -d                 # run the stack locally (web on :48181, api on :3001)
docker compose down
```

Single-package variants: `pnpm --filter @fishmap/web <script>`, `pnpm --filter @fishmap/api <script>`, etc. (package names: `@fishmap/web`, `@fishmap/api`, `@fishmap/types`, `@fishmap/scoring`).

Once test files exist: `pnpm --filter <package> exec vitest run <path>` for a single file, or `-t "<name>"` for a single test.

## Architecture

### Monorepo layout

- `apps/web` — React 18 + Vite + TypeScript (strict), the PWA.
- `apps/api` — Fastify, Node.
- `packages/types`, `packages/scoring` — shared code, imported by both apps.
- `tools/coastline-pipeline` — empty; Phase 4 of `DEV_PLAN.md` (OSM → vector tiles).

### `packages/types` and `packages/scoring` have no build step — this is load-bearing

Both packages' `main`/`types` fields point straight at `src/index.ts` — raw TypeScript, never compiled. This works because:
- **Vite** (`apps/web`) transpiles per-file with esbuild regardless of what a workspace package's `main` points to, so it handles raw `.ts` from a linked package transparently.
- **`apps/api` runs via `tsx`, in both dev *and production*** (`"start": "tsx src/server.ts"`, not `node dist/server.js`). This was a deliberate fix: a `tsc`-compiled API run with plain `node` would crash the moment it imports `@fishmap/scoring` or `@fishmap/types`, because Node can't execute a bare `.ts` file. Do not "fix" the API to build-then-run-with-node without first giving these two packages a real compile step — it will break at runtime, not at typecheck (typecheck passes fine either way, since TS resolves workspace packages via source regardless).

If either package ever needs a real build step (e.g. to ship a compiled artifact outside this monorepo), add `tsc` build scripts and repoint `main`/`types` at `dist/` — but that also means giving `apps/api`'s Dockerfile back a compile stage.

### Location is the app's spine, not the map

`apps/web/src/location/useActiveLocation.ts` is the single source of truth for "where is the app currently looking." URL search params (`?lat=&lon=&name=`) win on read; the Zustand store (persisted to localStorage) is the fallback when a route has none yet, and gets synced back into the URL. Every page calls this hook and never touches `searchParams` or the store directly. `DEV_PLAN.md` §6.1 is explicit that the map must never own this state — build order intentionally puts the location store before the map for this reason.

### Route-level code splitting for `/map`

Per `DEV_PLAN.md` §5.6, `/map` is meant to be the only route that pays for MapLibre's weight, loaded as a lazy chunk. As of Phase 1, `/map` is still a plain placeholder with a synchronous import — there is nothing heavy to lazy-load yet. When MapLibre is actually added (Phase 3), convert `MapPage` to a `React.lazy()` import; don't let map dependencies leak into the shared bundle.

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
