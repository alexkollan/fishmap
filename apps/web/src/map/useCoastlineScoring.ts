import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { Mode, WeatherSeries } from "@fishmap/types";
import { useWeightProfiles } from "@/lib/weightProfiles";
import { type CoastlineCollection, gridKeyOf, loadCoastline } from "./coastline";
import { fetchWeatherGrid } from "./gridWeatherClient";
import type { FromWorkerMessage, GridSeriesEntry, SegmentInput, ToWorkerMessage } from "./workerTypes";

const VIEWPORT_PAD_DEG = 0.35;

export const COASTLINE_SOURCE_ID = "coastline";
export const COASTLINE_LINE_LAYER_ID = "coastline-line";

function seriesKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export interface CoastlineScoringState {
  loading: boolean;
  error: string | null;
  fetchingGrid: boolean;
  hourlyTimes: string[];
  sparkline: (number | null)[];
  coastline: CoastlineCollection | null;
  seriesFor: (gridLat: number, gridLon: number) => WeatherSeries | undefined;
}

/**
 * Owns the whole map scoring pipeline (DEV_PLAN.md §5.2, §5.5): loads the
 * static coastline once, fetches only the 0.25° grid cells the current
 * viewport needs (batched, chunked under the API's per-request cap),
 * feeds a Web Worker, and paints results back onto the MapLibre source via
 * setFeatureState. Panning = fetch only what's new; scrubbing the hour =
 * zero network calls, one worker pass.
 */
export function useCoastlineScoring(map: MaplibreMap | null, mode: Mode, hourIndex: number): CoastlineScoringState {
  const [coastline, setCoastline] = useState<CoastlineCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchingGrid, setFetchingGrid] = useState(false);
  const [hourlyTimes, setHourlyTimes] = useState<string[]>([]);
  const [sparkline, setSparkline] = useState<(number | null)[]>([]);
  const weightProfiles = useWeightProfiles();

  const workerRef = useRef<Worker | null>(null);
  const gridCellsRef = useRef<Map<string, { lat: number; lon: number }>>(new Map());
  const fetchedKeysRef = useRef<Set<string>>(new Set());
  const seriesCacheRef = useRef<Map<string, WeatherSeries>>(new Map());
  const inflightRef = useRef(false);
  const modeRef = useRef(mode);
  const hourIndexRef = useRef(hourIndex);
  const segmentCountRef = useRef(0);

  modeRef.current = mode;
  hourIndexRef.current = hourIndex;

  // The coastline always shows Overall — per-factor "weather map" layers
  // render separately as a full-viewport heatmap (useAreaScoreGrid.ts).
  // Per-factor scores still ride along on every "scores" message because
  // the tap-to-inspect SpotSheet breakdown needs them.
  function paint(map: MaplibreMap, msg: Extract<FromWorkerMessage, { type: "scores" }>) {
    for (let i = 0; i < msg.ids.length; i++) {
      map.setFeatureState({ source: COASTLINE_SOURCE_ID, id: msg.ids[i]! }, { score: msg.overall[i]! });
    }
  }

  // Load the static coastline once.
  useEffect(() => {
    const controller = new AbortController();
    loadCoastline(controller.signal)
      .then(setCoastline)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, []);

  // Spin up the worker once.
  useEffect(() => {
    const worker = new Worker(new URL("./scoring.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const requestScore = () => {
    if (segmentCountRef.current === 0) return;
    const msg: ToWorkerMessage = { type: "score", hourIndex: hourIndexRef.current, mode: modeRef.current };
    workerRef.current?.postMessage(msg);
  };

  const requestSparkline = () => {
    if (segmentCountRef.current === 0) return;
    const msg: ToWorkerMessage = { type: "sparkline", mode: modeRef.current };
    workerRef.current?.postMessage(msg);
  };

  const refreshViewport = () => {
    if (!map || inflightRef.current || gridCellsRef.current.size === 0) return;
    const bounds = map.getBounds();
    const west = bounds.getWest() - VIEWPORT_PAD_DEG;
    const east = bounds.getEast() + VIEWPORT_PAD_DEG;
    const south = bounds.getSouth() - VIEWPORT_PAD_DEG;
    const north = bounds.getNorth() + VIEWPORT_PAD_DEG;

    const needed: { lat: number; lon: number }[] = [];
    for (const [key, cell] of gridCellsRef.current) {
      if (fetchedKeysRef.current.has(key)) continue;
      if (cell.lon < west || cell.lon > east || cell.lat < south || cell.lat > north) continue;
      needed.push(cell);
    }
    if (needed.length === 0) return;

    inflightRef.current = true;
    setFetchingGrid(true);
    fetchWeatherGrid(needed)
      .then((seriesList) => {
        const entries: GridSeriesEntry[] = [];
        for (const series of seriesList) {
          const key = seriesKey(series.gridLatitude, series.gridLongitude);
          seriesCacheRef.current.set(key, series);
          entries.push({ gridKey: key, series });
        }
        // Mark every requested cell fetched even on partial failure, so a
        // grid cell Open-Meteo has no data for doesn't retry every pan.
        for (const cell of needed) fetchedKeysRef.current.add(seriesKey(cell.lat, cell.lon));

        setHourlyTimes((prev) => (prev.length > 0 ? prev : (seriesList[0]?.hourly.map((h) => h.time) ?? prev)));

        if (entries.length > 0) {
          const msg: ToWorkerMessage = { type: "gridData", entries };
          workerRef.current?.postMessage(msg);
          requestScore();
          requestSparkline();
        }
      })
      .catch(() => {
        // Leave ungotten cells unfetched — next viewport change retries them.
      })
      .finally(() => {
        inflightRef.current = false;
        setFetchingGrid(false);
      });
  };

  // Once the coastline is loaded and the map exists: index grid cells,
  // hand segments to the worker, add the GeoJSON source/layer, and do the
  // first viewport fetch.
  useEffect(() => {
    if (!coastline || !map) return;

    const cells = new Map<string, { lat: number; lon: number }>();
    const segments: SegmentInput[] = coastline.features.map((f) => {
      const key = gridKeyOf(f.properties);
      if (!cells.has(key)) cells.set(key, { lat: f.properties.gridLat, lon: f.properties.gridLon });
      return { id: f.properties.id, aspectDeg: f.properties.aspectDeg, gridKey: key };
    });
    gridCellsRef.current = cells;
    segmentCountRef.current = segments.length;

    const segMsg: ToWorkerMessage = { type: "segments", segments };
    workerRef.current?.postMessage(segMsg);

    if (!map.getSource(COASTLINE_SOURCE_ID)) {
      map.addSource(COASTLINE_SOURCE_ID, {
        type: "geojson",
        // MapLibre's GeoJSONSourceSpecification typing doesn't know about
        // our extra properties — the shape is a standard FeatureCollection.
        data: coastline as unknown as FeatureCollection,
        promoteId: "id",
      });
      map.addLayer({
        id: COASTLINE_LINE_LAYER_ID,
        type: "line",
        source: COASTLINE_SOURCE_ID,
        layout: { "line-cap": "round" },
        paint: {
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.5, 10, 2.5, 14, 5],
          "line-color": [
            "case",
            ["==", ["feature-state", "score"], null],
            "#3a4750",
            [
              "interpolate",
              ["linear"],
              ["feature-state", "score"],
              0,
              "#f87171",
              50,
              "#facc15",
              100,
              "#4ade80",
            ],
          ] as unknown as string,
        },
      });
    }

    refreshViewport();
    map.on("moveend", refreshViewport);
    return () => {
      map.off("moveend", refreshViewport);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coastline, map]);

  // Push resolved weight profiles (admin overrides merged with defaults) to
  // the worker whenever they change, and re-score against them.
  useEffect(() => {
    const msg: ToWorkerMessage = { type: "weights", profiles: weightProfiles };
    workerRef.current?.postMessage(msg);
    requestScore();
    requestSparkline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightProfiles]);

  // Re-score (no network) whenever the hour changes; re-score + rebuild the
  // sparkline whenever the mode changes (mode reweights every hour, not
  // just the current one).
  useEffect(() => {
    requestScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourIndex, coastline]);

  useEffect(() => {
    requestScore();
    requestSparkline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, coastline]);

  // Paint worker results back onto the map / store the sparkline.
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    const onMessage = (event: MessageEvent<FromWorkerMessage>) => {
      if (event.data.type === "scores") {
        if (map) paint(map, event.data);
        return;
      }
      if (event.data.type === "sparkline") {
        setSparkline(event.data.values);
      }
    };

    worker.addEventListener("message", onMessage);
    return () => worker.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return {
    loading: coastline === null && error === null,
    error,
    fetchingGrid,
    hourlyTimes,
    sparkline,
    coastline,
    seriesFor: (gridLat, gridLon) => seriesCacheRef.current.get(seriesKey(gridLat, gridLon)),
  };
}
