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

**Beyond Phase 1 scope, done at explicit user request (not part of the original plan sequence):**
- Docker Compose `web` service moved to host port **48181** to match the Cloudflare Tunnel target on the OVH VPS deployment.
- Google Analytics 4 wired in, gated behind a GDPR consent banner (user's choice: simple banner, not Consent Mode-without-UI, not unconditional). Fires in both dev and prod (user's choice). Real measurement ID (`G-7QYJ7ETWPK`) is set in `apps/web/.env` and root `.env` (both gitignored — see `CLAUDE.md` for why two separate files are needed).

**Not yet started:** Phase 2 (`DEV_PLAN.md` §10 — Open-Meteo data spine, SunCalc/`/conditions/sun-moon`, coarse seasonality, single-point scoring, real `/`, `/forecast`, `/conditions/*` pages). Waiting on user direction to begin.

## Open items (need a human)

- **Git has no identity configured on this machine** (`git config --global user.name`/`user.email` both unset as of last check). Nothing in this repo has been committed yet. Set it, then a Claude session can commit — but never push (see `CLAUDE.md`).
- **GA4 real-hit verification is unconfirmed.** Everything up to the point a hit would be sent checks out (script loads with the real ID, consent-mode grant fires, `dataLayer` processes commands correctly) — but automated/headless-browser verification is structurally impossible (Google filters `navigator.webdriver` traffic, silently). The user checked GA4 Realtime once and didn't see themselves; they asked to set this aside for now rather than debug it immediately. Worth another look before considering analytics "confirmed working" — possible causes not yet ruled out: brand-new GA4 property still activating, a data stream config detail, or an ad-blocker/browser extension on the user's side.

## Deviations from `DEV_PLAN.md` as written

- Node 24 is in use locally (plan specifies Node 22); `engines` is pinned to `>=22` rather than an exact version, and nothing so far depends on a Node-22-specific behavior.
- `apps/api` ships without a `tsc` build step at all (runs via `tsx` in prod too) — see `CLAUDE.md` Architecture section for why. This is a deviation from the implied "Node 22 + Fastify + TypeScript" stack line reading as "compile then run," not a deviation from anything load-bearing in the plan's actual requirements.
