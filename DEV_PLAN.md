# Ψαρέματα — Greek Coastal Fishing Conditions PWA

**Development plan for Claude Code**
Owner/admin: Alex · Target: `fish.alexcoll.in` (Cloudflare Tunnel → OVH VPS)
Status: planning · v1 scope: Greek coastline only

---

## 0. TL;DR for the implementing agent

Build a dark-mode Progressive Web App that answers one question: **"Is it worth going fishing here, right now / tomorrow / Saturday?"**

It does this by:
1. Pulling free marine + atmospheric forecast data for a location the user picks — by search, by GPS, or by tapping the map.
2. Running a transparent, weighted scoring engine tuned by decades of angler heuristics.
3. Presenting the result across **a set of proper pages** — today's verdict, 7-day forecast, and dedicated wind / sea / pressure / sky / sun-moon detail pages — as well as on a map.
4. Painting the Greek coastline green→red by score, with per-parameter layer toggles, bathymetry, Posidonia and seamarks.
5. Working offline-ish, installable on iOS/Android/desktop, sending push alerts for good windows.

**The map is one view, not the app.** A user who never opens `/map` should still get full value. See §6.

**Also read §7.2 (iOS constraints) before making architectural commitments** — several of them are load-bearing.

**Hard constraint: it must never feel heavy.** Every architectural decision below is subordinate to that. Read §5 (Performance) before writing a line of map code.

---

## 1. Decisions already locked

| Decision | Value | Notes |
|---|---|---|
| Fishing modes | Shore/spinning, Boat/offshore, Spearfishing | Three separate weight profiles for scoring |
| Bathymetry | Free sources only (EMODnet ~115 m, GEBCO fallback) | No Navionics/C-MAP in v1; architecture keeps a paid tile provider swappable |
| Coverage | Greek coastline only | Bounding box ~34.5–41.8 N, 19.2–29.7 E |
| User accounts | **None** | Public read access. Single hardcoded admin (Alex) |
| Platform | PWA, installable, iOS + Android + desktop | No native app |
| Theme | Dark mode first (light theme optional later) | |
| Notifications | **User-configurable preferences** | Threshold, modes, quiet hours, frequency — all set by the user. No fixed default rule |
| Species targeting | **Out of v1** | General conditions score only. Coarse seasonality stays; per-species selector deferred to v2 |
| Wind particle animation | Behind flag `windParticles`, **default off** | Must prove its frame cost before wider rollout |
| UI language | Auto: **Greek in Greece, English elsewhere, English if unknown** | User can override manually |
| Curated spots | Start empty, added via admin panel | **Private to Alex by default**, per-spot publish toggle |
| peermap reuse | **No** | Build fresh; do not pull from the peermap repo |

---

## 2. Stack

Reuse the house stack where it fits, with **one deliberate deviation**.

```
Frontend   React 18 + Vite + TypeScript (strict)
Map        MapLibre GL JS   ← NOT Leaflet. See §5.1 for why this matters.
State      Zustand (tiny) + TanStack Query for server cache
Styling    Tailwind + CSS vars for theming
PWA        vite-plugin-pwa (Workbox under the hood)
Backend    Node 22 + Fastify + TypeScript
DB         SQLite (better-sqlite3), WAL mode
Jobs       node-cron in-process (no separate scheduler for v1)
Auth       Admin-only: argon2id password hash from env → JWT in httpOnly cookie
Testing    Vitest (unit) + Playwright (one smoke path)
Deploy     Docker Compose on OVH, behind cloudflared (alkoltunnel)
Notifs     Web Push (VAPID) for users · ntfy.alexcoll.in for admin/system alerts
```

**Why MapLibre instead of Leaflet:** we need to recolor thousands of coastline segments every time the user scrubs the time slider. Leaflet redraws vector features on the CPU via SVG/Canvas — that is exactly where the lag would come from. MapLibre renders vector tiles on the GPU and supports `setFeatureState()`, which lets us change the colour of 10,000 segments in a single frame without touching geometry. CARTO's Dark Matter style is available as a free MapLibre-compatible vector style, so we keep the dark look.

Leaflet stays a valid fallback if MapLibre causes trouble on older iPhones — §5.4 has the escape hatch.

---

## 3. Data sources (all free, no credit card)

### 3.1 Atmospheric + marine forecast — Open-Meteo
No API key, no auth, generous free tier for non-commercial use, CORS-enabled.

**Forecast API** (`api.open-meteo.com/v1/forecast`), hourly variables:
- `temperature_2m`, `apparent_temperature`
- `surface_pressure`, `pressure_msl` ← critical
- `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`
- `cloud_cover`, `precipitation`, `precipitation_probability`
- `visibility`, `relative_humidity_2m`
- `is_day`, `weather_code`

**Marine API** (`marine-api.open-meteo.com/v1/marine`), hourly variables:
- `wave_height`, `wave_direction`, `wave_period`
- `wind_wave_height`, `wind_wave_direction`, `wind_wave_period`
- `swell_wave_height`, `swell_wave_direction`, `swell_wave_period`
- `sea_surface_temperature`
- `ocean_current_velocity`, `ocean_current_direction`

**Critical capability:** both endpoints accept comma-separated `latitude` / `longitude` lists (hundreds of points in one request). This is the whole reason the coastline colouring can be cheap — see §5.2.

### 3.2 Sun, moon, solunar — computed locally
Use **SunCalc** (~3 KB). Zero API calls, works offline, instant.
Gives: sunrise/sunset, civil/nautical twilight, golden hour, moonrise/moonset, moon phase, illumination fraction, and moon altitude/azimuth — from which we derive solunar major/minor periods (§4.9).

### 3.3 Tides — deliberately de-emphasised
Aegean/Ionian tidal range is typically 5–30 cm; it is **not** a primary driver for Greek fishing, unlike the Atlantic. Do not build a tide engine in v1.

Two exceptions worth a special case later:
- **Evripos Strait (Chalkida)** — famous reversing tidal current, up to 8–9 knots, direction flips roughly every 6 hours. Worth a hardcoded special-case module eventually.
- **Narrow straits and channels generally** — where `ocean_current_velocity` from Open-Meteo already captures the useful signal. Use that instead of tides.

### 3.4 Bathymetry — EMODnet
- **EMODnet Bathymetry WMS/WMTS** — `ows.emodnet-bathymetry.eu`. Free, ~115 m grid, full Mediterranean coverage, includes a "mean depth" layer and contour layers. Serve as a raster overlay with opacity control.
- **GEBCO 2024** as fallback/deep-water filler (~450 m, global).
- **OpenSeaMap seamark tile layer** (`tiles.openseamap.org/seamark/{z}/{x}/{y}.png`) — free raster overlay with buoys, beacons, lights, harbours. Transparent PNG, drops straight on top.

⚠️ **Legal:** EMODnet, GEBCO and OpenSeaMap are explicitly **not for navigation**. A permanent disclaimer must appear in-app (§10.3).

### 3.5 Seabed habitat / "algae" — EMODnet Seabed Habitats
- **EUSeaMap** broad-scale habitat WMS via `ows.emodnet-seabedhabitats.eu`.
- Key layer for Greek fishing: **Posidonia oceanica** meadows. Posidonia beds are nurseries — the *edges* where meadow meets sand or rock are prime structure for sargos, tsipoura, and are the single most useful spearfishing hint on the map.
- Render as a semi-transparent overlay, toggleable.

### 3.6 Coastline geometry — OpenStreetMap
Extract `natural=coastline` ways for the Greek bbox from a Geofabrik `.osm.pbf` extract, **offline, once, at build time**. Also worth extracting as separate point layers: `man_made=pier`, `man_made=breakwater`, `waterway` river mouths, `seamark:type=harbour`, lighthouses. These become curated-spot candidates.

### 3.7 Base map
CARTO **Dark Matter** vector style (free tier, attribution required). Fits the dark-mode requirement out of the box and is already GPU-rendered.

---

## 4. The scoring engine — the fisherman's parameter set

This is the heart of the app. Everything else is plumbing.

**Design principles:**
- Every parameter produces a normalised sub-score **0–100** via an explicit curve.
- Final score = weighted sum, **but** certain parameters act as **hard vetoes** (safety, unfishable conditions) that clamp the total regardless of everything else.
- Weights differ per fishing mode and are **editable live by admin** (§8).
- The UI must always be able to answer **"why this score?"** with a ranked contribution breakdown. Never show a bare number.

### 4.1 Barometric pressure — the single most argued-about factor
Anglers agree on the *trend*, not the absolute value. Rate of change beats level.

| Condition | Sub-score | Reasoning |
|---|---|---|
| Falling 1–3 hPa over 3–6 h (front approaching) | **95–100** | Classic feeding frenzy window; fish sense the drop and load up before the weather turns |
| Slowly falling (<1 hPa / 6 h) | 80 | Good, steady improvement |
| Stable, 1013–1020 hPa | 65 | Fishable, predictable, unspectacular |
| Stable high >1022 hPa | 45 | Fish sink, go lethargic; work deeper and slower |
| Rising sharply after a front (+2 hPa / 3 h) | **15–25** | The worst condition in fishing folklore. Give it 24–36 h |
| Very low <1005 hPa | 30 | Usually paired with storm — safety veto takes over anyway |

Implementation: compute `Δp` over 3 h, 6 h and 24 h windows from the hourly series. Score the 3 h and 6 h deltas primarily; use 24 h for the "front passed / front coming" narrative text.

**Weight: highest or near-highest for shore and boat. Near zero for spearfishing** (a spearo cares about visibility, not fish appetite).

### 4.2 Wind — speed AND direction relative to shore aspect
Speed alone is meaningless. What matters is wind *relative to the coastline segment's facing direction* (its aspect/bearing). This is why we precompute aspect per segment (§5.2).

**Shore fishing:**
- **Onshore wind, 8–20 km/h** → best case (score 90–100). Pushes plankton → baitfish → predators into the shallows, creates coloured water that gives predators cover, oxygenates.
- Cross-shore 10–20 km/h → 75. Workable, good for drifting.
- Offshore wind → 50. Flattens the water, kills the food push, but makes casting easy and keeps things clear.
- Onshore >35 km/h → drops fast; >45 km/h → veto (unfishable/dangerous on rocks).
- Dead calm (<5 km/h) → 45 in daylight, 65 at night/dawn.

**Boat:** invert the priority — comfort and safety dominate. <15 km/h ideal, 15–25 acceptable, >30 hard veto.
**Spearfishing:** any wind that raises chop hurts visibility. <10 km/h ideal, >20 veto.

**Greek-specific wind patterns to encode as context labels** (not scores, but shown to the user):
- **Meltemi** (N/NE, May–Sept, can blow 5–7 Beaufort for days): east- and north-facing Aegean coasts become unfishable while west-facing lee shores stay glassy. The app should surface this automatically as "*lee shore — sheltered from today's Meltemi*", which is genuinely the killer feature for a Greek fishing app.
- **Sirocco / Ostria** (S/SE): warm, humid, often ahead of a low. Usually a good pressure trend but murky water.
- **Tramountana** (N): cold, clear, high pressure — often a post-front slow bite.

### 4.3 Wave height, period and direction
- **Shore:** 0.2–0.7 m onshore swell is the sweet spot (score 90–100). Whitewater disorients baitfish and gives predators cover — for lavraki (sea bass) especially, a bit of surf is the *best* condition. 0.7–1.2 m → 60, getting hard to fish. >1.5 m → veto (rock safety).
- **Boat:** <0.5 m ideal, 0.5–1.0 m fine, 1.0–1.5 m uncomfortable, >2 m veto.
- **Spearfishing:** <0.2 m ideal, >0.5 m veto.
- **Wave period** matters for water clarity: long-period swell (>8 s) moves water without stirring sediment; short-period wind chop (<5 s) makes soup. Use period as a modifier on the turbidity proxy (§4.4).

### 4.4 Water clarity / turbidity — derived, not fetched
No free real-time turbidity source at useful resolution. Model it:

```
turbidity_index = f(wave_height, wave_period, precipitation_24h,
                    distance_to_river_mouth, seabed_substrate)
```
- High wind-wave + short period + sandy bottom → murky.
- Rocky bottom + long swell → stays clear.
- >20 mm rain in 24 h within 5 km of a river mouth → murky for ~48 h.

Then: **murky is mildly good for shore predator fishing** (cover), **catastrophic for spearfishing**. Same input, opposite sign depending on mode. Make this explicit in the code — it's the clearest example of why weight profiles per mode are non-negotiable.

### 4.5 Sea surface temperature — absolute and, more importantly, delta
- Absolute SST maps to species activity ranges (§4.11 species calendar).
- **A drop of >2 °C in 48 h shuts the bite down** almost everywhere. Penalise hard (sub-score → 25).
- A gentle warming trend in spring → bonus.
- Aegean seasonal range roughly 14 °C (Feb) to 27 °C (Aug).

### 4.6 Time of day — the strongest single predictor
- **Dawn window** (sunrise −60 min to +90 min): 100.
- **Dusk window** (sunset −90 min to +60 min): 100. Dusk is generally the best for squid/kalamari and for shore predators.
- Full night: 75 for lavraki, squid, conger; 30 for most daytime species.
- Midday (10:00–16:00) in summer under clear sky: 25.
- Midday under heavy overcast: 60 — overcast extends the low-light advantage across the whole day. **This interaction (cloud × time-of-day) must be multiplicative, not additive.**

### 4.7 Cloud cover
- 60–100 % overcast → 85. Fish spread out of structure, feed longer, less spooky.
- 20–60 % broken → 75.
- 0–20 % clear + midday → 40.
- Interacts with §4.6. Implement as a modifier applied to the light-level sub-score rather than as an independent term.

### 4.8 Precipitation
- Light rain / drizzle (0.1–2 mm/h) → 85. Surface disturbance, washes food in, drops the light.
- Moderate (2–8 mm/h) → 65, if you can tolerate being wet.
- Heavy (>8 mm/h) → 35 and drives the turbidity model.
- **Thunderstorm risk → hard veto.** Lightning + carbon rods + open water. Non-negotiable, not user-overridable.

### 4.9 Moon phase and solunar periods
Genuinely contested among anglers — but consistent enough to include with moderate weight and full user visibility.

- **Major periods:** moon transit (overhead) and anti-transit (underfoot), ~±1 h each. Compute from SunCalc's moon azimuth/altitude.
- **Minor periods:** moonrise and moonset, ~±45 min.
- **Phase:** new and full moons → stronger currents and, in the Med, noticeably more nocturnal activity. Score 85. Quarters → 60.
- **Illumination for night fishing:** cuts both ways and is species-dependent. Bright full moon = better squid jigging visibility but spookier sea bass in shallow clear water. Encode per species, not globally.
- **Highest-value alignment:** a solunar major period that coincides with dawn or dusk. When this happens, flag it prominently — it is the strongest combined signal the app can produce.

### 4.10 Current — where it matters
`ocean_current_velocity` from the Marine API. **Moving water beats slack water** almost universally. 0.2–0.8 kn → 90. Slack (<0.05 kn) → 45. >2 kn → hard to present a bait, 50, and a boat-anchoring problem.

Weight this heavily for segments flagged as capes, straits, or channel mouths, where current concentrates bait.

### 4.11 Seasonality (v1) and species calendar (v2)

**v1 scope: no species selector.** The engine produces one general "fishing conditions" score. Seasonality still contributes, but as a single coarse factor derived from month + SST + daylight — roughly "how active is the Greek coastal fishery generally right now" — not per-species.

Concretely, in v1 `seasonality()` takes month and SST and returns a broad activity multiplier: autumn (Sep–Nov) peaks, late winter (Feb–Mar) troughs, summer midday penalised, summer night neutral. One curve, no species argument. Keep the function signature accepting an optional species list so v2 slots in without a refactor.

**The table below is reference data for v2** — ship it as a seed JSON file so it's ready, but do not wire a selector, admin CRUD, or per-species weighting in v1:

| Species (GR / EN) | Peak season | SST band | Notes |
|---|---|---|---|
| Λαβράκι / Sea bass | Oct–Apr | 12–20 °C | Loves surf, murky water, onshore wind, dawn/dusk/night |
| Τσιπούρα / Gilthead bream | Sep–Dec | 16–24 °C | Sandy-rocky mix, Posidonia edges, calm–moderate |
| Παλαμίδα / Bonito | **Aug–Nov** | 20–25 °C | Autumn run, surface schools, calm mornings, boat & shore spinning |
| Σαργός / White seabream | Year-round, best Oct–Feb | 14–22 °C | Rocky, some swell, daylight |
| Καλαμάρι / Squid | **Oct–Mar** | 14–20 °C | Dusk and night, calm, some moonlight, 5–20 m over weed/sand |
| Μελανούρι / Saddled bream | Jun–Sep | 20–26 °C | Shallow rocky, bright day is fine |
| Γόπα / Bogue | Year-round | — | Bait species; presence indicates predator potential |
| Σκουμπρί / Mackerel | Nov–Mar | 13–18 °C | Schooling, harbours and piers |
| Χταπόδι / Octopus | Oct–Apr | — | Spearfishing; needs clear calm |

*v2 intent:* the active species set filters the scoring, since a "good day" is only meaningful relative to what's in season and what the user is targeting. A target-species selector would reweight the engine (e.g. selecting squid pushes dusk, calm and moonlight weights up). Design the factor interfaces now so this is additive later.

### 4.12 Static spot factors (baked per coastline segment)
These don't change with weather; precompute once and store on the segment (§5.2):
- **Aspect / facing bearing** — the linchpin for all wind and swell relative calculations.
- **Fetch / exposure** — open-sea distance in the facing direction; controls how much a given wind actually builds waves.
- **Nearshore depth gradient** — steep dropoff within 100 m = boat/spearo interest and shore access to deep water. Sample from EMODnet at build time.
- **Substrate** — rock / sand / Posidonia / mixed, from EUSeaMap.
- **Structure proximity** — pier, breakwater, cape, river mouth, harbour light, wreck.
- **Land access** — is there a road or path within 200 m? Turns a theoretically-good spot into a reachable one.

### 4.13 Composite formula sketch

```ts
type Mode = 'shore' | 'boat' | 'spearfishing';

interface FactorScore { key: string; score: number; weight: number; note: string }

function scoreSegment(seg: Segment, wx: WeatherHour, mode: Mode, profile: WeightProfile) {
  const factors = [
    pressureTrend(wx),
    windRelative(wx, seg.aspect, seg.fetch, mode),
    waveConditions(wx, seg, mode),
    turbidity(wx, seg, mode),
    seaTemp(wx, seg),
    lightWindow(wx, seg),        // time-of-day × cloud, multiplicative
    solunar(wx, seg),
    current(wx, seg),
    seasonality(wx),              // v1: coarse month+SST curve, no species arg
    structure(seg),
  ];

  const vetoes = checkVetoes(wx, mode);           // storm, wind, wave, lightning
  if (vetoes.length) return { score: Math.min(20, weighted(factors, profile)), vetoes, factors };

  return { score: weighted(factors, profile), vetoes: [], factors };
}
```

Return the full `factors` array to the client. The "Why?" panel is a first-class feature, not a debug view — it's what earns the user's trust in the number and what lets Alex tune the weights against real outings.

---

## 5. Performance architecture — read this before writing map code

The stated constraint is *"it must not lag."* Here is how each risk is neutralised.

### 5.1 Never render the coastline as thousands of Leaflet polylines
Greece has ~16,000 km of coastline (mainland + ~6,000 islands). At 500 m segmentation that's ~32,000 features. Drawing and restyling those on the CPU per time-slider tick is the single biggest lag risk in this project.

**Solution:** precompute segments into **Mapbox Vector Tiles** at build time (tippecanoe), serve as static `.pbf` files from the VPS via nginx with long cache headers, and render with MapLibre. Colouring is applied with `setFeatureState(segmentId, { score })` and a data-driven `line-color` expression. Changing 30,000 colours becomes a GPU uniform update, not a re-render.

### 5.2 Weather is spatially smooth — exploit it hard
Do **not** fetch weather per coastline segment. Instead:

1. Snap the current viewport to a **0.25° grid** (~25 km).
2. Fetch all grid points in the viewport in **one** batched Open-Meteo call (comma-separated coords). A typical zoomed-out Aegean viewport is ~40–80 grid points — one request.
3. **Bilinearly interpolate** grid values to each segment's centroid client-side. This is cheap arithmetic over a typed array.
4. Score in a **Web Worker** so the main thread never blocks. Post back a `Float32Array` of scores keyed by segment index.

Result: panning the whole Aegean = one network request and one worker pass. Scrubbing the time slider = **zero** network requests (the forecast series is already in memory) and one worker pass.

### 5.3 Level of detail by zoom
| Zoom | Rendered | Segment length |
|---|---|---|
| z5–7 | Regional aggregate polygons (coarse coastal zones) | ~10 km |
| z8–10 | Simplified coastline | ~2 km |
| z11–13 | Full segments | ~500 m |
| z14+ | Full segments + curated spots + structure markers | ~500 m |

tippecanoe handles the simplification per zoom automatically. Never render z14 detail at z6.

### 5.4 Fallback plan
If MapLibre GL proves problematic on older iOS Safari, degrade to Leaflet + `Leaflet.VectorGrid` with the Canvas renderer, consuming the *same* vector tiles, at reduced LOD. Keep the tile generation pipeline map-library-agnostic so this swap is a frontend-only change.

### 5.5 Caching, layered
- **Backend:** SQLite cache table keyed on `(grid_lat, grid_lon, model_run, variable_set)`. TTL 60 min for atmospheric, 3 h for marine. Serve stale-while-revalidate on upstream failure. Cuts Open-Meteo calls by ~95 % across users.
- **Raster proxy:** EMODnet WMS is slow and rate-limited. Proxy it through Fastify, cache tiles on disk with a 30-day TTL (bathymetry doesn't change). Serve from nginx thereafter. **Do not point the browser directly at EMODnet.**
- **Client:** TanStack Query in memory; IndexedDB for the last-fetched forecast so a cold offline open still shows something useful; Workbox cache-first for map tiles and app shell.

### 5.6 Route-level code splitting — now the biggest single win
Because the app is multi-page (§6), **most routes don't need the map at all**. MapLibre plus its style and glyphs is by far the heaviest dependency, and it should be dynamically imported **only on `/map`**.

- `/`, `/forecast`, `/conditions/*`, `/windows`, `/settings` ship with **no map code whatsoever** — just charts and text. These pages should be near-instant.
- Charting library also lazy-loaded, and only on routes that chart. Prefer something small (uPlot, ~40 KB) over Recharts/Chart.js given the budget.
- The scoring worker is only spun up on `/map`. Single-location pages score one point inline — one call to the same pure functions, no worker, no grid interpolation, no measurable cost.
- Prefetch `/map`'s chunk on idle after first paint, so tapping Map still feels immediate without paying for it upfront.

This also means the entry route matters: a push notification should deep-link to `/` or `/forecast`, **not** `/map`. Cold-starting into the heaviest route from a notification is the worst first impression the app can make.

### 5.7 Performance budget (enforce in CI)
- Initial JS ≤ 180 KB gzipped for non-map routes; ≤ 380 KB once the map chunk loads on `/map`.
- Time to interactive ≤ 2.5 s on a simulated mid-tier Android over 4G.
- Sustained 55+ fps while panning.
- Peak heap < 150 MB.
- Fail the build on regression. Use Lighthouse CI.

---

## 6. Feature set and UI

**This is not a map app with some extra screens. It is a conditions app, and the map is one of several views onto the same data.** A user should be able to search for "Σούνιο", never open the map at all, and still get everything — full forecast, wind breakdown, moon phase, sun times, the lot — on well-designed, readable pages.

### 6.1 The active location is the app's spine

Everything hangs off a single global concept: **the currently selected location**. It's set from four places, all equivalent:

1. Device geolocation ("use my location").
2. **Search** — place name, beach, town, or raw coordinates (Nominatim, debounced, results cached in IndexedDB; respect their 1 req/s policy).
3. Tapping the map.
4. Picking from recents or saved spots.

Once set, it persists across navigation, survives reload, and is **encoded in the URL** so every page is deep-linkable and shareable:

```
/                       → today's verdict for the active location
/map                    → the coastline view
/forecast?lat=37.65&lon=24.03&name=Sounio
/conditions/wind?lat=…&lon=…
/conditions/moon?lat=…&lon=…
```

Implementation: a `useActiveLocation()` hook over a Zustand store, synced to URL search params and mirrored to localStorage. Pages read from the hook and never care how the location got there. **Do not let the map own the location state** — that's the mistake that makes everything else feel like a bolt-on.

### 6.2 Page inventory

| Route | Page | Purpose |
|---|---|---|
| `/` | **Today** | The headline answer. Big score, plain-language verdict, the two or three factors driving it, next good window, sun/moon strip. This is the page most people will open and close without touching anything else — treat it as the front door, not a dashboard of widgets. |
| `/map` | **Map** | Coastline scoring, layers, time scrubber (§6.3). |
| `/forecast` | **Forecast** | 7-day outlook. Day cards with per-day score, expandable to an hourly table. Score sparkline across the whole week so good windows jump out. |
| `/conditions/wind` | **Wind** | Speed, gusts, direction over time. Compass rose showing direction relative to the local shore aspect. Beaufort labels. Meltemi/Sirocco context when it applies. |
| `/conditions/sea` | **Sea** | Wave height, period, swell direction, sea temperature, currents. Includes the derived water-clarity estimate with its reasoning shown. |
| `/conditions/pressure` | **Pressure** | The barometric chart with the 3h/6h/24h trend called out, plus a plain-language read ("falling steadily — front arriving tomorrow afternoon"). |
| `/conditions/sky` | **Sky** | Cloud cover, precipitation, visibility, air temperature. |
| `/conditions/sun-moon` | **Sun & moon** | Sunrise/sunset, twilight bands, moonrise/moonset, phase with an actual drawn moon, illumination %, solunar major/minor windows on a 24h timeline. **Works fully offline** — computed locally. |
| `/windows` | **Best windows** | Ranked upcoming opportunities (§6.6). |
| `/spots` | **Spots** | Saved and published spots (§6.7). |
| `/settings` | **Settings** | Notifications, language, units, theme, data export. |
| `/admin/*` | **Admin** | §8. |

Each `/conditions/*` page follows the same template: current value → chart over time → what it means for fishing → how it's weighted in the score. Consistency here matters more than per-page cleverness; a user who learns to read the wind page should already know how to read the pressure page.

### 6.3 Map view
- Dark base map, coastline painted green (100) → yellow (50) → red (0) by score for the selected hour and mode.
- **Time scrubber** along the bottom: next 7 days, hourly resolution, with a mini sparkline of the overall score so good windows are visible at a glance without scrubbing.
- **Mode switch:** Shore / Boat / Spearfishing — instantly reweights and repaints.
- **"My location"** button (permission requested on tap, never on load — see §7.3).
- Tap a coastline segment or drop a pin → detail sheet.

### 6.4 Layer control (the per-parameter requirement)
A layer drawer where each parameter can be viewed **alone or combined**:

*Score layers* (recolour the coastline by a single factor): Overall · Wind · Waves · Pressure · Water temp · Clarity · Current · Light/time.

*Overlay layers* (drawn on top, independent toggles): Bathymetry (EMODnet, opacity slider) · Depth contours · Posidonia / seabed habitat · Seamarks (OpenSeaMap) · Wind particles (flag `windParticles`, **default off**, expensive) · My spots (admin only until published).

*Info panels* (non-map): Moon phase & solunar · Sun times · 7-day summary.

Persist layer state to localStorage so the app opens the way it was left.

### 6.5 Spot detail sheet (map only)
On tapping a location, a bottom sheet gives the summary — it is *not* a replacement for the detail pages. Every row in it links through to the relevant `/conditions/*` page for that location, which is the main bridge between the map and the rest of the app.
- Big score + one-line verdict ("Very good — falling pressure and onshore breeze at dusk").
- **Factor breakdown bar chart**, ranked by contribution, positive and negative.
- Active vetoes shown in red at the top if any.
- Hourly strip for the next 48 h.
- Depth at that point, substrate, aspect, exposure.
- Sun/moon times, next solunar window.

### 6.6 "Best windows" view
Arguably the feature people will actually open the app for. Scan the next 7 days × the user's saved locations and list the top 10 time windows, ranked, each with a one-line reason. Feeds directly into notifications (§7.4).

### 6.7 Spots — two separate things, don't conflate them

**User spots.** No accounts, so they live locally in IndexedDB, per-device, with JSON export/import (the only "backup" available without accounts — make the export button obvious). Never leave the device.

**Admin spots (Alex's).** Stored server-side in SQLite, added via the admin panel, and **private by default**. Each spot has a `visibility` column:

```sql
CREATE TABLE spots (
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
```

Enforcement rules, to be got right the first time:
- `GET /api/spots` returns **only** `visibility='public'` rows. The `private` filter is applied in the SQL query, not in application code after the fetch, and not on the client.
- `GET /api/admin/spots` returns everything, behind the admin JWT.
- The public endpoint must never leak count, ID range, or coordinates of private spots. No `total` field that includes them.
- Add a unit test asserting that an unauthenticated request to `/api/spots` returns zero private rows, seeded with a mix of both. This is the kind of thing that silently breaks during a later refactor.

Publishing is a per-spot toggle in the admin panel — nothing becomes visible to anyone else without an explicit flip.

### 6.8 Navigation and layout

- **Mobile:** bottom tab bar — Today · Map · Forecast · Spots · Settings. The `/conditions/*` pages are reached from Today and from the map sheet, not from the tab bar; five tabs is the ceiling.
- **Desktop:** persistent left sidebar with the full route list, and a location search box pinned in the header so switching areas is one action from anywhere.
- **The location header is global.** Every page except `/admin` renders the same header showing the active location name with a tap-to-change affordance. Changing location on the wind page keeps you on the wind page, now showing the new location. This is the behaviour that makes the app feel coherent rather than like a map with satellites.
- Back/forward and browser history work properly, because location lives in the URL (§6.1).

### 6.9 Visual design direction

The detail pages carry the app's quality perception — a map can look impressive with no design effort, a data page cannot. Some direction so this doesn't default to generic dashboard:

- **Dark, but not black.** Deep desaturated blue-grey ground (roughly `#0E1418`–`#141C21`), not pure `#000`. Pure black next to a dark map looks cheap and crushes the chart lines.
- **One accent ramp** for the score (green → amber → red), used *only* for score. Never use the score colours for decoration, or the coding stops meaning anything.
- **Charts, not gauges.** Circular gauges and speedometer widgets waste space and read poorly on mobile. Small multiples of clean line/area charts over a shared time axis are more useful and more attractive.
- **Type does the work.** One display size for the headline number, one for section titles, one for body, one for units/labels. Numbers in a tabular-figure font so columns align.
- **Generous whitespace, few borders.** Separate sections with space, not boxes-inside-boxes.
- **Plain-language summaries above every chart.** "Onshore breeze building through the afternoon" before the wind chart, not after. The chart is evidence; the sentence is the answer.
- Respect `prefers-reduced-motion`; keep transitions under 200 ms.

---

## 7. PWA specifics

### 7.1 Installability
`manifest.webmanifest` with `display: standalone`, maskable icons (192/512), `theme_color` dark, `background_color` matching the shell, `orientation: any`, and shortcuts to "Best windows" and "My location".

### 7.2 iOS quirks — plan around them, don't discover them late
- No `beforeinstallprompt` on iOS. Ship a custom "Add to Home Screen" tutorial sheet, shown once, iOS-only, dismissible.
- **Web Push works on iOS 16.4+ only when the app is installed to the Home Screen**, and permission must be requested from a user gesture. Detect standalone mode (`navigator.standalone` / `display-mode: standalone`) and only offer notifications there; otherwise explain the install requirement.
- Background sync and periodic background sync are unavailable on iOS. **All scheduled notifications must therefore originate server-side** — never rely on the client waking itself up.
- Service worker storage is evicted after ~7 days of non-use on iOS. Never treat IndexedDB as durable; always be able to re-fetch.

### 7.3 Geolocation
- `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: false` (a fishing spot doesn't need 3 m accuracy, and high accuracy drains battery).
- **Request on user gesture only.** A permission prompt on page load is the fastest way to get permanently denied.
- Fallbacks, in order: last known location from localStorage → coarse IP geolocation → manual search (Nominatim, rate-limit-respecting, cached) → default to a sensible Greek centroid.
- Graceful degrade: the app must be fully usable with no location permission at all.

### 7.4 Notifications — user-configured

**Web Push with VAPID.** Subscriptions stored in SQLite (endpoint + keys + preferences, no personal data, no email, no identity).

Every user sets their own rules. Ship a dedicated Notification Settings screen with:

| Setting | Type | Default (pre-filled, not enforced) |
|---|---|---|
| Enabled | toggle | off — never subscribe without an explicit opt-in |
| Watched locations | list of pinned coords, max 5 | current location |
| Score threshold | slider 50–95 | 80 |
| Fishing mode | shore / boat / spearfishing | shore |
| Lookahead | 12 h / 24 h / 48 h / 7 days | 24 h |
| Quiet hours | time range, no pushes inside it | 23:00–06:00 |
| Max frequency | 1/day, 1/12h, 1/6h | 1/12h per location |
| Alert types | multi-select: good window · sharp pressure drop · storm/safety warning | good window + safety |

Notes for implementation:
- Defaults are **pre-filled suggestions in the form**, not silent server-side behaviour. Nothing fires until the user saves.
- Preferences live in the subscription row so the server cron can evaluate them without the client being open — essential, since iOS gives us no client-side scheduling (§7.2).
- Mirror preferences to localStorage so the settings UI renders instantly offline.
- **Safety warnings ignore quiet hours and frequency caps.** A storm alert at 04:00 for someone heading out is the entire point.
- Every push carries a deep link to the exact time window that triggered it.
- Cron runs hourly, batches by grid cell so one weather fetch serves many subscribers.
- Include an unsubscribe path that actually deletes the row, and prune subscriptions on `410 Gone` from the push service.

**ntfy.alexcoll.in** stays for Alex's own system alerts (upstream API failure, cron errors, cache-miss spikes) — reuse the existing setup rather than building a monitoring path.

### 7.5 Language detection
Greek for users in Greece, English everywhere else, English when we can't tell.

Resolution order, first hit wins:
1. **Manual override** from localStorage — always respected, never re-detected over.
2. **Geolocation**, if permission is already granted: point-in-bbox against Greece (34.5–41.8 N, 19.2–29.7 E), then a rough polygon check to avoid catching western Turkey. Do **not** request geolocation permission just to pick a language.
3. **Timezone**: `Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Athens'` → Greek. Cheap, no permission, and correct for the large majority of Greek users.
4. **`Accept-Language`** header contains `el` → Greek.
5. **Fallback: English.**

A language switcher lives in settings and writes the manual override. Use a small i18n layer (`i18next` or a hand-rolled dictionary — the string count is low enough that hand-rolled is defensible). Greek strings are first-class, not machine-translated afterthoughts: fishing terminology in Greek is specific and a bad translation will read as amateurish to exactly the audience this is for.

### 7.6 Offline behaviour
- App shell + last-viewed map tiles + last forecast payload cached.
- On offline open: show cached data with a prominent "Data from HH:MM" staleness banner.
- Sun/moon/solunar are computed locally, so those **always work offline** — a genuinely useful offline feature on a boat with no signal.

---

## 8. Admin (Alex) and feature flags

No public accounts. One admin.

**Auth:** `ADMIN_PASSWORD_HASH` (argon2id) in env → `POST /api/admin/login` → JWT in an httpOnly, Secure, SameSite=Strict cookie, 7-day expiry. Rate-limit login attempts (5 per 15 min per IP). That's proportionate — it's one account behind a Cloudflare Tunnel, not a bank.

**Feature flags table:**
```sql
CREATE TABLE feature_flags (
  key         TEXT PRIMARY KEY,
  description TEXT,
  state       TEXT NOT NULL CHECK(state IN ('off','admin_only','rollout','on')),
  rollout_pct INTEGER DEFAULT 0,
  updated_at  INTEGER NOT NULL
);
```
- `GET /api/flags` returns the resolved flag set for the requester (admin cookie → sees `admin_only` flags too).
- `rollout` uses a stable hash of the anonymous client ID so a given device gets a consistent experience.
- Frontend: `useFlag('windParticles')`. Every non-trivial new feature ships behind a flag, defaulting to `admin_only`. This gives exactly the workflow requested — build it, test it live as Alex, then flip it on for everyone or kill it.

**Admin panel (`/admin`):**
- Feature flag toggles.
- **Live scoring weight editor** — sliders per factor per mode, with a preview map that repaints as you drag. This is the tool for tuning the engine against real fishing outings, and it's the highest-value admin feature by a distance.
- **Spots CRUD** — add, name, describe, and flip `private` ↔ `public` per spot. Private is the default on create; the publish action should require a deliberate second click, not a stray toggle.
- API usage dashboard: Open-Meteo call count, cache hit rate, EMODnet proxy stats.
- Push subscription count, preference distribution (useful for knowing what thresholds people actually pick), and last-send log.
- Global announcement banner (e.g. "storm warning — stay off the rocks").

---

## 9. Project structure

```
fishmap/
├─ apps/
│  ├─ web/                       # React + Vite PWA
│  │  ├─ src/
│  │  │  ├─ routes/              # one folder per page — today, map, forecast,
│  │  │  │                       #   conditions/{wind,sea,pressure,sky,sun-moon},
│  │  │  │                       #   windows, spots, settings, admin
│  │  │  ├─ location/            # active-location store, URL sync, search
│  │  │  ├─ map/                 # MapLibre setup, layers, style — lazy chunk
│  │  │  ├─ scoring/             # worker + client-side interpolation
│  │  │  ├─ charts/              # shared chart primitives (uPlot wrappers)
│  │  │  ├─ ui/                  # header, nav, score badge, layout shell
│  │  │  ├─ lib/                 # suncalc wrappers, geo helpers, idb, i18n
│  │  │  └─ workers/scoring.worker.ts
│  │  └─ public/manifest.webmanifest
│  └─ api/                       # Fastify
│     ├─ src/
│     │  ├─ domain/              # scoring rules — pure, no I/O, shared with web
│     │  ├─ adapters/            # open-meteo, emodnet-proxy, push
│     │  ├─ routes/
│     │  ├─ jobs/                # cron: notifications, cache warm
│     │  └─ db/                  # migrations, queries
├─ packages/
│  ├─ scoring/                   # ← shared pure scoring lib (web + api both import)
│  └─ types/
├─ tools/
│  └─ coastline-pipeline/        # one-off build: OSM → segments → attrs → MVT
├─ docker-compose.yml
└─ FISHING_APP_PLAN.md
```

**Key structural point:** the scoring rules live in `packages/scoring` as pure functions with no I/O. Both the browser worker and the notification cron import the identical code. There must never be two implementations of the score that can drift apart.

---

## 10. Build order

### Phase 1 — Skeleton (foundations)
- Monorepo, Docker, Fastify health check, Cloudflare Tunnel route to `fish.alexcoll.in`.
- **Router, app shell, nav, and the active-location store with URL sync (§6.1).** Build this before the map — if the map comes first it will end up owning location state and everything after fights that.
- Location search (Nominatim, debounced, cached) + geolocation with full fallback chain.
- Placeholder pages for every route in §6.2, so the shape of the app is visible immediately.
- **Locale detection (§7.5) and the i18n scaffold from day one.** Retrofitting i18n over hardcoded strings is miserable; wrap every string as it's written, even if only English is populated at first.
- PWA manifest + service worker, installable on iOS and Android. **Verify iOS install on a real iPhone before proceeding** — don't defer this.

### Phase 2 — Data spine
- Open-Meteo adapter (forecast + marine), batched, with the SQLite cache layer.
- SunCalc integration; `/conditions/sun-moon` fully built — the first genuinely useful screen, and it works offline.
- Coarse seasonality curve (§4.11) — month + SST, no species.
- Single-point scoring for the active location.
- **Build `/`, `/forecast` and the `/conditions/*` pages here, with charts and design direction from §6.9.** At the end of Phase 2 the app should already be worth using with no map in it at all. If it isn't, the map won't save it.

### Phase 3 — Map foundation
- MapLibre + CARTO Dark Matter rendering Greece, as a lazy route chunk.
- Tap-to-select feeding the existing location store.
- Spot detail sheet linking through to the detail pages.

### Phase 4 — Coastline pipeline
- `tools/coastline-pipeline`: OSM extract → 500 m segmentation → compute aspect, fetch, depth gradient, substrate → tippecanoe → MVT.
- Static tile serving with cache headers.
- Render coastline, uncoloured, and confirm the performance budget holds at 30k features **before** adding scoring on top.

### Phase 5 — Coastline scoring
- `packages/scoring` with every factor from §4, unit-tested against hand-built fixtures.
- Web Worker interpolation + scoring.
- Coastline colouring via `setFeatureState`.
- Time scrubber.
- Mode switch (shore / boat / spearfishing).
- "Why this score?" breakdown panel.

### Phase 6 — Layers and depth
- EMODnet bathymetry proxy + disk tile cache.
- Depth contours, Posidonia/habitat, OpenSeaMap seamarks.
- Layer drawer with per-parameter score views.
- Wind particles built behind flag `windParticles`, state `admin_only`. Measure the frame cost honestly before considering a wider rollout.

### Phase 7 — Admin
- Login, JWT, feature flags end to end.
- Weight editor with live preview.
- Spots CRUD with the private/public visibility model (§6.5), including the leak test.

### Phase 8 — Notifications and polish
- Web Push, VAPID, subscription storage with per-user preferences (§7.4).
- Notification Settings screen.
- Cron evaluator honouring thresholds, quiet hours and frequency caps; safety alerts bypassing them.
- Deep links from pushes land on `/forecast` or `/`, never `/map` (§5.6).
- "Best windows" view.
- User spots in IndexedDB, export/import.
- Full Greek translation pass (native, not machine — see §7.5).
- Lighthouse CI performance gate.

### Deferred to v2
- Target-species selector and per-species weighting (seed data already shipped, §4.11).
- Evripos Strait tidal-current special case (§3.3).
- Restricted-area / fishing-regulation overlay (§10.3).
- Light theme.

### 10.3 Non-negotiables checklist
- [ ] Prominent, permanent **"Not for navigation"** disclaimer. Bathymetry here is scientific-grade, not chart-grade.
- [ ] Safety veto for thunderstorms and high seas that the user **cannot** override.
- [ ] Attribution: OpenStreetMap, CARTO, EMODnet, GEBCO, OpenSeaMap, Open-Meteo. Each has terms; honour them.
- [ ] Open-Meteo free tier is non-commercial. If this ever goes commercial, budget for their paid tier.
- [ ] Greek fishing regulations vary by area and season (closed seasons, protected zones, minimum sizes, spearfishing restrictions near swimmers and in marine parks). v1 should link to the relevant authority rather than attempt to encode the law. Consider an admin-managed "restricted area" overlay in v2.

---

## 11. Open questions — surface these during implementation

Round 1 is resolved (see §1). Things likely to need a call once code exists:

1. **Segment length.** 500 m is the plan, but the real number falls out of Phase 3 profiling on a mid-tier phone. If 30k features are comfortable, consider 250 m near cities and harbours where spot quality varies over short distances.
2. **Whether the coastline score should be per-segment or per-zone at low zoom.** Colouring individual 500 m segments at z6 is visually noisy and arguably misleading — the weather grid is 25 km, so adjacent segments will be near-identical. May want to render aggregated coastal zones below z9 and only reveal segment detail higher up.
3. **What "no data" looks like.** Open-Meteo marine coverage thins in enclosed gulfs and very shallow water. Grey-out, fall back to atmospheric-only scoring with a caveat, or hide the segment? Needs a decision once you can see how often it happens on the Greek coast.
4. **Score presentation.** 0–100 invites false precision. Consider showing a 5-band label (Poor / Fair / Good / Very good / Excellent) as the primary display with the number secondary. Worth deciding after the first real outings tell you whether the numbers are trustworthy.

---

## 12. Notable risks

| Risk | Mitigation |
|---|---|
| EMODnet WMS slow/flaky | Aggressive disk-cached proxy; GEBCO fallback; overlay is optional, never blocks the app |
| Open-Meteo rate limits under load | Grid snapping + shared server cache means ~1 upstream call serves many users |
| 30k coastline features lag on old iPhones | MVT + GPU + LOD; Leaflet fallback path kept open |
| Scoring "feels wrong" to real anglers | Live weight editor + factor transparency; tune against actual outings. Assume v1 weights are a hypothesis, not truth |
| iOS PWA restrictions surface late | Test install + push on a real device in Phase 1, not Phase 7 |
| Private spots leak through the public API | Filter in SQL, not app code; dedicated test asserting zero private rows on the public endpoint (§6.5) |
| Notification fatigue drives uninstalls | User-set thresholds, quiet hours, frequency caps, opt-in only (§7.4) |
