# Vendored files

## maplibre-gl-worker.mjs + maplibre-gl-shared.mjs

Verbatim copies of `node_modules/maplibre-gl/dist/{maplibre-gl-worker,maplibre-gl-shared}.mjs`
from the installed `maplibre-gl` version (currently 6.4.1).

**Why these are hand-copied instead of imported normally:** MapLibre's
worker file imports its sibling chunk via a plain relative path
(`import ... from "./maplibre-gl-shared.mjs"`), and expects both files to
sit next to each other, unhashed, exactly as maplibre-gl ships them.
Vite's `?url` import mechanism (the normal way to reference a file as a
static asset) treats the imported file as opaque — it copies the *one*
file you reference into `dist/assets/` with a content hash, but has no
way to know it also needs to copy that file's own internal sibling
import. In dev this went unnoticed because `vite.config.ts` excludes
`maplibre-gl` from dependency pre-bundling, so the whole package (all
sibling files included) is served straight from `node_modules` at its
real relative layout. In a production build, only the worker file got
emitted — its shared-chunk dependency 404'd, and because this is an SPA
with an `index.html` fallback for unmatched routes, that 404 came back
disguised as a 200 (wrong content, but no error status), so nothing
during a network check even flagged it as failing. Symptom: MapLibre
constructs fine and click handlers work (main thread only), but nothing
ever renders — a black map with zero console errors.

Putting both files here, verbatim and unhashed, in `public/` means Vite
copies them through untouched (no bundling, no hashing) and their
relative import to each other keeps working. `apps/web/src/map/MapCanvas.tsx`
points `setWorkerUrl()` at `/vendor/maplibre-gl-worker.mjs` explicitly
instead of relying on MapLibre's own (dev-server-layout-dependent) guess.

**If you upgrade `maplibre-gl`:** re-copy both files from the new
version's `dist/` folder. If the new version's worker file imports a
differently-named shared chunk (or none at all), update accordingly —
check what it actually imports before assuming these two names are still
right.
