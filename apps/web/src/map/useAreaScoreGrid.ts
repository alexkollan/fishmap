import { useEffect, useRef } from "react";
import type { ImageSource, Map as MaplibreMap } from "maplibre-gl";
import type { Mode } from "@fishmap/types";
import { COASTLINE_LINE_LAYER_ID } from "./useCoastlineScoring";
import type { ScoreLayerKey } from "./useMapLayers";
import type { AreaGridResponse, FromAreaWorkerMessage, ToAreaWorkerMessage } from "./areaHeatmapTypes";

export const AREA_HEATMAP_SOURCE_ID = "area-heatmap";
export const AREA_HEATMAP_LAYER_ID = "area-heatmap-layer";

// 1x1 transparent PNG — placeholder used only for the initial addSource
// call (the "image" source type requires a url at creation per the style
// spec); every real frame after that goes through updateImage({ image })
// with the worker's ImageBitmap directly, no network round trip.
const BLANK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/**
 * Renders the selected factor layer (wind/waves/pressure/seaTemp/turbidity/
 * current/light) as a full-viewport color overlay sourced from the
 * backend's precomputed area grid (GET /api/scores/area) — the coastline
 * itself always stays on Overall (useCoastlineScoring.ts's paint()) since
 * Overall depends on the live-editable weight profile and this grid
 * deliberately doesn't. Selecting "overall" just hides this layer.
 */
export function useAreaScoreGrid(map: MaplibreMap | null, mode: Mode, hourIndex: number, scoreLayer: ScoreLayerKey) {
  const workerRef = useRef<Worker | null>(null);
  const gridRef = useRef<AreaGridResponse | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);
  const scoreLayerRef = useRef(scoreLayer);
  scoreLayerRef.current = scoreLayer;

  // Spin up the worker once, wire its replies straight into the map.
  useEffect(() => {
    const worker = new Worker(new URL("./areaHeatmap.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<FromAreaWorkerMessage>) => {
      if (!map || event.data.type !== "bitmap") return;
      const { bitmap, bbox } = event.data;

      const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
        [bbox[0], bbox[3]], // top-left: minLon, maxLat
        [bbox[2], bbox[3]], // top-right: maxLon, maxLat
        [bbox[2], bbox[1]], // bottom-right: maxLon, minLat
        [bbox[0], bbox[1]], // bottom-left: minLon, minLat
      ];

      const existing = map.getSource(AREA_HEATMAP_SOURCE_ID) as ImageSource | undefined;
      if (existing) {
        existing.updateImage({ image: bitmap });
      } else {
        map.addSource(AREA_HEATMAP_SOURCE_ID, { type: "image", url: BLANK_PNG, coordinates });
        // No beforeId if the coastline layer doesn't exist yet is fine: that
        // layer's own effect always appends with no beforeId too, so
        // whichever of the two mounts second still ends up on top — the
        // coastline (and, later, any overlay) stays visually above this.
        map.addLayer(
          {
            id: AREA_HEATMAP_LAYER_ID,
            type: "raster",
            source: AREA_HEATMAP_SOURCE_ID,
            layout: { visibility: scoreLayerRef.current === "overall" ? "none" : "visible" },
            paint: { "raster-resampling": "linear" },
          },
          map.getLayer(COASTLINE_LINE_LAYER_ID) ? COASTLINE_LINE_LAYER_ID : undefined,
        );
        (map.getSource(AREA_HEATMAP_SOURCE_ID) as ImageSource).updateImage({ image: bitmap });
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Toggle visibility without refetching when flipping back to Overall.
  useEffect(() => {
    if (!map || !map.getLayer(AREA_HEATMAP_LAYER_ID)) return;
    map.setLayoutProperty(AREA_HEATMAP_LAYER_ID, "visibility", scoreLayer === "overall" ? "none" : "visible");
  }, [map, scoreLayer]);

  // Fetch only when mode/hour actually changes — switching between factors
  // at the same mode/hour just re-renders the already-fetched grid.
  useEffect(() => {
    if (!map || scoreLayer === "overall") return;

    const key = `${mode}|${hourIndex}`;
    if (gridRef.current && lastFetchKeyRef.current === key) {
      const msg: ToAreaWorkerMessage = { type: "render", grid: gridRef.current, factorKey: scoreLayerRef.current };
      workerRef.current?.postMessage(msg);
      return;
    }
    lastFetchKeyRef.current = key;

    const controller = new AbortController();
    const url = new URL("/api/scores/area", window.location.origin);
    url.searchParams.set("mode", mode);
    url.searchParams.set("hourIndex", String(hourIndex));

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Area score grid request failed: ${res.status}`);
        return res.json() as Promise<AreaGridResponse>;
      })
      .then((grid) => {
        gridRef.current = grid;
        const msg: ToAreaWorkerMessage = { type: "render", grid, factorKey: scoreLayerRef.current };
        workerRef.current?.postMessage(msg);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        lastFetchKeyRef.current = null; // let the next attempt retry
      });

    return () => controller.abort();
  }, [map, mode, hourIndex, scoreLayer]);
}
