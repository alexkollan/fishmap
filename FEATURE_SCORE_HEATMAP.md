# Feature TODO — All-Greece score heatmap with per-parameter selection

**Status: researched, not started. Not approved for build — one decision is open (see §7).**
Proposed 2026-09-16 (user's friend's idea, third of three parts; parts 1 and 2 — map as homepage, and the forecast time scrubber — shipped the same day, see `PROGRESS.md`).

## 1. What was asked for

> Scoped just in Greece, is it possible to get the data for the forecast of all parameters we are looking for our scores for ALL greece and then color (heatmap) the map based on how good/bad they are and based on the drag bar the user plays with? The end result should be a map heatmapped by score, but if the user choses, heatmapped by each parameter separately. Also it would be nice for users to be able to select parameters on the fly and combine them (ex: let's see the score and heatmap based only on solunar and wind, or only based on water temperatre and air temperature and any combination whatsoever).

So: a whole-Greece heatmap, driven by the existing time scrubber, switchable between the composite score, any single factor, or an arbitrary user-chosen combination of factors.

## 2. Why this is not simply "the thing that already failed twice"

This repo removed map-wide scoring twice (see `PROGRESS.md` 2026-08-24 and 2026-08-25, and `CLAUDE.md`'s map section). The headline number from that failure is **115 minutes for a cold sweep**, recurring on every 12h cron tick. That history is real and any plan has to start from it.

But two things were wrong with that specific implementation that are not inherent to the idea:

- **It fetched 26 variables per cell; scoring only uses 15.** The other 11 (`apparent_temperature`, `visibility`, `relative_humidity_2m`, the three `swell_wave_*`, the three `wind_wave_*`, `surface_pressure`, `precipitation_probability`) are never read by any factor in `packages/scoring`.
- **It never masked to water.** It swept the full rectangular Greek bbox. `CLAUDE.md` already carries a correction noting the land-exclusion step was written up but never actually committed — so the 115-minute figure is for the *unfiltered* rectangle, and the masked version has never been measured.

**Measured 2026-09-16** using the orphaned `apps/web/public/data/coastline.geojson` (8,965 segments — currently referenced by nothing, finally useful here) as a proximity mask:

| Resolution | Full rect | Within 15 km of coast | Within 30 km | × 15 vars (15 km) | vs. the 204k cell-vars that died |
|---|---|---|---|---|---|
| 0.5° | 352 | **114** (32%) | 177 | 1,710 | 119× less |
| 0.25° | 1,290 | **467** (36%) | 694 | 7,005 | **29× less** |
| 0.1° | 7,844 | **2,895** (37%) | 4,344 | 43,425 | 4.7× less |

Calibration point: the wind/current/pressure layer that **works today** and cold-sweeps in **under 25 seconds** is 352 cells × 5 variables = 1,760 cell-variables (`apps/api/src/jobs/vectorFieldRefresh.ts`).

So 0.25° masked ≈ **4× the load of a pipeline that currently takes 25 seconds** → extrapolates to roughly 90–120 seconds on the free tier. That is a categorically different proposition from 115 minutes.

⚠️ **This is an extrapolation, not a measurement.** Open-Meteo's exact billing unit is still not pinned down — `CLAUDE.md` records the empirical finding that ~6 successful 100-location requests tripped the per-minute cap, which is consistent with "locations × variables" but doesn't nail the constant. **§6 Phase 0 exists to settle this before anything else is built.**

## 3. Architecture

### 3.1 The constraint that drives everything

**A composite score raster cannot be precomputed.** If the user can select an arbitrary subset of factors on the fly, the backend cannot know the combination in advance. Therefore:

- Backend precomputes and caches **per-factor sub-scores** (all 10, each 0–100) per cell per hour — *not* the weighted composite.
- Client combines the selected subset into a displayed value.
- This falls out nicely: `scoreHour()` already returns `factors[]` with individual scores, so the backend runs existing code and simply doesn't collapse the result.

### 3.2 Rendering

A **MapLibre `CustomLayerInterface` WebGL2 layer**, factors packed as texture channels, the combination evaluated as a dot product against a weight vector uniform in the fragment shader.

Why not the simpler canvas + `image` source used by the pressure layer (`useWindyLayer.ts`): with a shader, toggling a parameter or changing weights is a uniform update — no refetch, no CPU re-raster, instant. Given the whole feature is "let users recombine parameters on the fly", that interactivity *is* the feature. `apps/web/src/map/particleLayer.ts` already establishes the WebGL2 custom-layer precedent in this codebase.

### 3.3 Payload

Quantise factor scores to **uint8** — they're 0–100, so a byte each is ample.

`467 cells × 10 factors × 72 hours ≈ 336 KB`, and it gzips well (neighbouring cells correlate strongly). 72 hours rather than the full 168 keeps this tractable; the single-point scrubber already covers 7 days for the pinned spot.

At 0.1° / 2,895 cells this becomes ~2 MB and would need chunking by time window.

### 3.4 Modes

Factor curves are mode-dependent (wind, waves, turbidity all differ per mode), so the raster is per-mode. **This costs CPU, not API quota** — all three modes score from the same fetched weather. Precompute all three.

## 4. Design decisions to settle before building

1. **Dynamic weights vs. user-selected weights.** The contextual weight modulation shipped 2026-09-16 (`packages/scoring/src/modulation.ts`) means effective weights now vary per cell per hour. If a user selects a subset of factors, do they get base weights or modulated ones? Modulated is the intellectually consistent answer — it's the whole point of that feature — but it means shipping a second raster of effective weights, roughly doubling the payload. Options: ship modulated weights at coarser time resolution (3-hourly), or accept base weights for custom combinations and use modulated only for the default composite.

2. **Several parameters have no spatial variation.** A solunar-only heatmap of Greece is a **flat colour** — moon phase is identical countrywide and solunar windows shift only trivially with longitude. Seasonality is likewise flat (it's month + SST band). The parameter picker should mark or disable these rather than let someone select "solunar only" and conclude the feature is broken. Genuinely spatial: wind, waves, turbidity, sea temp, light/cloud, precipitation, pressure, current.

3. **Vetoes need their own channel.** A thunderstorm cell must read as unfishable regardless of which parameters are selected, so ship a per-cell/hour veto bitmask alongside the factor scores.

4. **Mask radius.** 15 km of coast (467 cells at 0.25°) vs 30 km (694). 15 km covers shore and nearly all small-boat fishing; 30 km is more generous for boat mode at ~1.5× the cost.

5. **Refresh cadence.** The old design's fatal detail was that per-cell TTLs were shorter than the cron interval, so *every* tick was a cold sweep, forever. Whatever cadence is chosen, TTL must exceed it.

## 5. Interaction with what already shipped

- The **time scrubber** (`apps/web/src/map/TimeScrubber.tsx`) already exists and already emits a selected hour — the heatmap subscribes to the same state. No new UI concept needed for time.
- The **pin panel** (`MapScorePanel.tsx`) stays as-is: it's a single-point lookup and unaffected.
- `GREECE_BBOX` (`apps/api/src/lib/bbox.ts`) and `buildAreaGrid()` (`apps/api/src/lib/areaGrid.ts`) are reusable; the grid builder just needs a step parameter and a mask filter.

## 6. Suggested sequencing

- **Phase 0 — measurement spike (half a day, do this first).** Fetch one hour for the 467 masked cells with the real 15 variables, instrumented for wall time and rate-limit responses. This replaces the extrapolation in §2 with a number. **If this comes back bad, the whole feature reverts to the §7 paid/GRIB question immediately, before any code is written.**
- **Phase 1** — mask builder (coastline proximity → cell list, committed as JSON so it isn't recomputed at runtime; note the prior attempt's mask was lost by never being committed — do not repeat that).
- **Phase 2** — refresh job + cache, reusing `cachedBatch()` with a distinct `variable_set` value (must not collide with `forecast`/`marine`/`area_forecast`/`area_marine`).
- **Phase 3** — `GET /api/fields/score`, read-only from cache, same principle as `routes/fields.ts`.
- **Phase 4** — WebGL heatmap layer.
- **Phase 5** — parameter picker UI, wired to the existing scrubber.

## 7. Open decision — blocks the build

0.25° is ~25 km per cell. That resolution answers *"is the Ionian better than the Dodecanese today"*. It will **not** answer *"which cove"*.

Three paths:

| Path | Resolution | Cost | Effort |
|---|---|---|---|
| **A. Free tier, 0.25° masked** | ~25 km, regional | Free | Low — proven pipeline shape |
| **B. Paid Open-Meteo, 0.1° masked** | ~10 km | Their paid tiers drop the minute/hour/day caps for a monthly budget — needs pricing check | Low, same shape as A |
| **C. GRIB files (NOAA GFS / ECMWF open data)** | Any | Free | High — GRIB2 parsing, storage, resampling |

C is how Windy actually does it: fetch a raster for the whole Mediterranean per model cycle rather than per-location point queries, which removes per-location billing entirely and scales to any resolution. It's the right long-term answer and the most work.

Recommendation: **run Phase 0, ship A, and let the real thing on screen decide whether B or C is worth it.** Judging "is 25 km good enough" from a screenshot is far more reliable than judging it from a table.

**The question to answer: is coarse regional guidance enough for v1, or is cove-level detail the entire point?**
