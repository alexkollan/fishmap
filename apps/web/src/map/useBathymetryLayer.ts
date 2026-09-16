import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";

/** Depth levels the pipeline emits, shallow to deep (tools/bathy-pipeline). */
const LEVELS = [5, 10, 20, 30, 40, 50, 75, 100, 150, 200];

const SOURCE_ID = "bathy-contours";
const FILL_LAYER = "bathy-fill";

/** Shelf-scale isobaths always draw; the dense inshore set waits for zoom. */
const SHOWN_TIERS = [
  {
    lineId: "bathy-line-coarse",
    labelId: "bathy-label-coarse",
    depthFilter: [">=", ["get", "depth"], 50],
    lineMinzoom: 0,
    labelMinzoom: 8,
  },
  {
    lineId: "bathy-line-fine",
    labelId: "bathy-label-fine",
    depthFilter: ["<", ["get", "depth"], 50],
    lineMinzoom: 10,
    labelMinzoom: 11,
  },
] as const;

const ALL_LAYER_IDS = [
  ...SHOWN_TIERS.map((t) => t.labelId),
  ...SHOWN_TIERS.map((t) => t.lineId),
  FILL_LAYER,
];

interface BathyIndex {
  cellDeg: number;
  levels: number[];
  chunks: [number, number][];
}

/**
 * Blue depth ramp, shallow to deep. Deliberately *not* EMODnet's own
 * multicolour/rainbow styles, which both paint shallow water RED and deep
 * water GREEN — in this app red and green are the score vocabulary, so a red
 * shoreline would read as "bad conditions here". A single-hue blue ramp is
 * both unambiguous and what actual chartplotters use.
 */
const DEPTH_COLORS: Record<number, string> = {
  5: "#7fb7d9",
  10: "#6aa6cd",
  20: "#5794c1",
  30: "#4782b3",
  40: "#3a71a4",
  50: "#2f6194",
  75: "#265283",
  100: "#1e4372",
  150: "#173560",
  200: "#12294e",
};

/** Bands are drawn shallowest-first and each deeper band paints over the one
 * above it, so a single flat opacity per layer composites into a smooth
 * ramp instead of stacking into mud. */
const FILL_OPACITY = 0.55;

/** Loaded chunks are evicted past this, keeping only what the viewport
 * touches. Roughly a screenful at the zooms this layer is useful at. */
const MAX_LOADED_CHUNKS = 12;

function chunkKey(lon: number, lat: number): string {
  return `${lon}_${lat}`;
}

/**
 * C-MAP-style depth contours: blue depth bands, isobath lines, and numeric
 * depth labels.
 *
 * Data is our own (tools/bathy-pipeline) rather than EMODnet's rendered
 * `emodnet:contours` WMS, because that layer's shallowest contour is 50 m —
 * it has nothing at all in the 0-40 m band that shore fishing and
 * spearfishing actually happen in. The pipeline contours EMODnet's raw DTM
 * instead, at 5/10/20/30/40 m inshore.
 *
 * Chunks are 1° GeoJSON files loaded on demand as the viewport moves; the
 * whole Greek coast is ~11 MB, so loading it eagerly is not an option. Each
 * loaded chunk is merged into one GeoJSON source — MapLibre has no
 * multi-file vector source without real vector tiles, and tippecanoe isn't
 * available in this environment (see CLAUDE.md).
 */
export function useBathymetryLayer(map: MaplibreMap | null, enabled: boolean) {
  const [index, setIndex] = useState<BathyIndex | null>(null);
  const loadedChunks = useRef(new Map<string, Feature[]>());
  const inFlight = useRef(new Set<string>());
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!enabled || index) return;
    let cancelled = false;
    void fetch("/data/bathy/index.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BathyIndex | null) => {
        if (!cancelled && data) setIndex(data);
      })
      .catch(() => {
        /* layer simply stays empty */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, index]);

  // Create/remove the source and its three renderings of the same geometry.
  useEffect(() => {
    if (!map) return;

    if (!enabled) {
      for (const id of ALL_LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      loadedChunks.current.clear();
      return;
    }

    if (map.getSource(SOURCE_ID)) return;
    map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

    // Step expression over the `depth` property, shallow to deep.
    const colorExpr: (string | number | string[])[] = ["step", ["get", "depth"], DEPTH_COLORS[5]!];
    for (const level of LEVELS.slice(1)) colorExpr.push(level, DEPTH_COLORS[level]!);

    map.addLayer({
      id: FILL_LAYER,
      type: "fill",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "band"],
      paint: { "fill-color": colorExpr as never, "fill-opacity": FILL_OPACITY, "fill-antialias": false },
    });
    // Decluttered by zoom, the way a paper chart is: the coarse isobaths
    // (50 m and deeper) carry the shape of the shelf and are always drawn,
    // while the dense inshore set (5-40 m) only appears once you're zoomed
    // in far enough for it to be legible. Without this the shallow contours
    // hug the coast so tightly at low zoom that Greece gets a white fringe.
    for (const tier of SHOWN_TIERS) {
      map.addLayer({
        id: tier.lineId,
        type: "line",
        source: SOURCE_ID,
        filter: ["all", ["==", ["get", "kind"], "isobath"], tier.depthFilter] as never,
        minzoom: tier.lineMinzoom,
        paint: {
          "line-color": "rgba(220,235,245,0.55)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 12, 0.9, 15, 1.4],
        },
      });
      map.addLayer({
        id: tier.labelId,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["all", ["==", ["get", "kind"], "isobath"], tier.depthFilter] as never,
        minzoom: tier.labelMinzoom,
        layout: {
          "symbol-placement": "line",
          "text-field": ["concat", ["to-string", ["get", "depth"]], " m"],
          "text-size": 10,
          "text-letter-spacing": 0.05,
          // Repeat along long contours so a label is reachable without
          // panning, the way a paper chart repeats its isobath values.
          "symbol-spacing": 260,
          "text-max-angle": 35,
          "text-padding": 4,
        },
        paint: {
          "text-color": "#dbeafe",
          "text-halo-color": "rgba(8,14,20,0.9)",
          "text-halo-width": 1.4,
        },
      });
    }

    return () => {
      for (const id of ALL_LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      loadedChunks.current.clear();
    };
  }, [map, enabled]);

  // Load whichever chunks the viewport touches, then push the merged set.
  useEffect(() => {
    if (!map || !enabled || !index) return;

    async function syncViewport() {
      if (!map || !index) return;
      const bounds = map.getBounds();
      const step = index.cellDeg;
      const wanted: [number, number][] = [];
      for (const [lon, lat] of index.chunks) {
        if (
          lon + step >= bounds.getWest() &&
          lon <= bounds.getEast() &&
          lat + step >= bounds.getSouth() &&
          lat <= bounds.getNorth()
        ) {
          wanted.push([lon, lat]);
        }
      }

      let added = false;
      await Promise.all(
        wanted.map(async ([lon, lat]) => {
          const key = chunkKey(lon, lat);
          if (loadedChunks.current.has(key) || inFlight.current.has(key)) return;
          inFlight.current.add(key);
          try {
            const res = await fetch(`/data/bathy/${key}.geojson`);
            if (!res.ok) return;
            const fc = (await res.json()) as FeatureCollection;
            loadedChunks.current.set(key, fc.features);
            added = true;
          } catch {
            /* skip this chunk */
          } finally {
            inFlight.current.delete(key);
          }
        }),
      );

      // Evict chunks well away from the viewport. Without this, panning the
      // length of Greece accumulates all 74 chunks (~19 MB of parsed
      // GeoJSON) in memory and grows every setData call with it.
      let evicted = false;
      if (loadedChunks.current.size > MAX_LOADED_CHUNKS) {
        const keep = new Set(wanted.map(([lon, lat]) => chunkKey(lon, lat)));
        for (const key of [...loadedChunks.current.keys()]) {
          if (!keep.has(key)) {
            loadedChunks.current.delete(key);
            evicted = true;
          }
        }
      }

      if (!added && !evicted) return;
      const source = map.getSource(SOURCE_ID);
      if (source && "setData" in source) {
        const features: Feature[] = [];
        for (const chunk of loadedChunks.current.values()) features.push(...chunk);
        (source as GeoJSONSource).setData({ type: "FeatureCollection", features });
        forceRender((v) => v + 1);
      }
    }

    void syncViewport();
    map.on("moveend", syncViewport);
    return () => {
      map.off("moveend", syncViewport);
    };
  }, [map, enabled, index]);
}
