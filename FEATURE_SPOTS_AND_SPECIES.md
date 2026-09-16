# Research — fishing spots and species data: what's actually available

**Status: researched, nothing built.** 2026-09-17. Every finding below was verified by calling the API, not taken from documentation.

## 1. The headline answer

**There is no open database of "good fishing spots."** That data is the entire commercial value of Fishbrain, Fishidy and similar apps — it is user-generated, proprietary, and not licensed for reuse. Nobody publishes it.

What *is* openly available, and genuinely useful, is the three things that let you *infer* a good spot:

1. **Which species have actually been recorded where** — OBIS, excellent coverage.
2. **Where commercial fleets fish** — EMODnet Human Activities, a real proxy for productive ground.
3. **Where fishing is restricted** — MPAs and Natura 2000, legally important and the most defensible feature of the three.

## 2. Verified working

### OBIS (Ocean Biodiversity Information System) — the strongest find

Free, no key, CC-BY. `https://api.obis.org/v3/`

Greek bbox (19–30 E, 34–42 N) statistics, fetched live:

```
records 579,163 | species 6,158 | taxa 9,546 | datasets 253 | years 1841–2026
```

A checklist query for ray-finned fish (`taxonid=10194`) over the Saronic gulf returned, with record counts:

```
204  Siganus rivulatus      (rabbitfish, Lessepsian invasive)
145  Siganus luridus
102  Thalassoma pavo
 80  Coris julis
 63  Serranus cabrilla
 52  Serranus scriba
 50  Sarpa salpa
 43  Pterois miles          (lionfish, invasive)
 40  Diplodus sargus        (white seabream — a real Greek target species)
 40  Torquigener flavimaculosus
```

Useful shape: `POLYGON(...)` geometry filter plus `taxonid`, so "what's been recorded near this pin" is one request. Caveat: this is **scientific survey and citizen-science effort, not catch data** — record counts reflect where researchers sampled as much as where fish are. A dive-survey-heavy bay will outrank a genuinely better but unsurveyed one.

### EMODnet Human Activities — WFS, EU-wide

`https://ows.emodnet-humanactivities.eu/wfs` — GetCapabilities confirmed. Relevant layers:

- `emodnet:marineprotectedareas`, `emodnet:natura2000areas` — **where fishing is restricted.** Query returned real features. This is the highest-value, lowest-risk feature on this page: telling someone they're about to fish in a protected area is unambiguously useful and it fits the app's existing safety/honesty posture.
- `emodnet:fishingstaticgears`, `fishingbottomottertrawls`, `fishingpelagic`, `csquareeffortbyfishtech` — commercial fishing effort on a c-square grid (`lat`, `lon`, `fsh__fo`, `mw_fshn`, year ranges). Real, and a genuine productivity proxy. **Greek coverage not yet confirmed** — the sample rows returned were North Sea, since the layer is ICES-derived and Mediterranean coverage may be partial. Verify before designing around it.
- `emodnet:fishsalesbyspecies`, `emodnet:fishquotasbyspecies` — landings and quota by species. Regional/statistical, not spot-level.

### WoRMS — taxonomy and vernacular names

`https://www.marinespecies.org/rest/` — works, no key. Returns accepted names and AphiaIDs, and has vernacular endpoints. This is how OBIS's scientific names become **Greek common names** (τσιπούρα, σαργός, λαβράκι), which matters a lot for this app's audience.

## 3. Verified weak or unavailable

| Source | Status |
|---|---|
| **OpenStreetMap / Overpass** | **Effectively empty for Greece.** A query for `leisure=fishing`, `fishing=yes`, `natural=reef` and `seamark:type=wreck` across 36–39 N, 21.5–25.5 E returned **102 features total**. Not a viable spot source. |
| **FishBase API** | Down. `fishbase.ropensci.org` did not respond; `fishbase.se/api` returns 404. Its species traits (depth range, demersal/pelagic, habitat) would pair *perfectly* with our depth contours, so it's worth chasing a working endpoint or the bulk dataset. |
| **GBIF** | API responds but my occurrence query returned 0 for the Greek bbox — parameters need work. OBIS is the better marine source regardless; GBIF is worth revisiting only if OBIS coverage gaps appear. |
| **Fishbrain / Fishidy / commercial apps** | No open API. Spot data is proprietary and user-generated. |

## 4. What this suggests building, in order

1. **Protected-area overlay + warning.** Open data, verified, legally meaningful, and complements the "Not for navigation" honesty already in the app. Lowest risk, clearest value.
2. **"Species recorded near here"** in the spot panel, from OBIS, with Greek common names via WoRMS. Must be labelled honestly as *survey records*, not "what you'll catch" — the sampling bias is real and a fisherman will spot a wrong claim immediately.
3. **Species × depth cross-reference** — pair FishBase depth preferences with our contour data to answer "which of these species should be at the depth I'm fishing." This is the genuinely novel one and the reason to chase a working FishBase endpoint.
4. **Commercial effort overlay** — only after confirming Greek coverage.

## 5. The honest framing

The app cannot tell someone where the fish are. It can tell them what has been *recorded* nearby, at what depths those species live, when conditions suit, and where they are not allowed to fish. That's a defensible product; "best spots" from open data would not be.

If spot-level data is ever wanted, the only legitimate route is **generating it** — the app's own users marking spots and catches. That's a network-effect feature, not a data-acquisition one, and the existing `spots` table is already the right foundation.
