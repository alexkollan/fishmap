import { useEffect, useRef, useState } from "react";
import { Map as MaplibreMap, Marker, NavigationControl, setWorkerUrl, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ActiveLocation } from "@fishmap/types";
import { COASTLINE_LINE_LAYER_ID } from "./useCoastlineScoring";

// MapLibre auto-locates its worker by constructing a URL relative to
// wherever its own JS happened to load from — that guess is only ever
// right by accident of dev-server layout, so we point it explicitly at a
// vendored copy instead (public/vendor/, see the README there for why
// it's a manual copy rather than a normal import).
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

// CARTO Dark Matter, free tier, vector, GPU-rendered (DEV_PLAN.md §3.7).
const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const GREECE_BOUNDS: [number, number, number, number] = [19.2, 34.5, 29.7, 41.8];

interface MapCanvasProps {
  center: ActiveLocation;
  onReady: (map: MaplibreMap) => void;
  onSegmentTap: (props: Record<string, unknown> | null, lngLat: { lng: number; lat: number }) => void;
}

export function MapCanvas({ center, onReady, onSegmentTap }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [center.lon, center.lat],
      zoom: 8,
      maxBounds: [
        [GREECE_BOUNDS[0] - 4, GREECE_BOUNDS[1] - 3],
        [GREECE_BOUNDS[2] + 4, GREECE_BOUNDS[3] + 3],
      ],
      attributionControl: { compact: true },
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      mapRef.current = map;
      onReady(map);
    });

    map.on("click", (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(
        [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ],
        { layers: map.getLayer(COASTLINE_LINE_LAYER_ID) ? [COASTLINE_LINE_LAYER_ID] : [] },
      );
      const hit = features[0];
      onSegmentTap((hit?.properties as Record<string, unknown>) ?? null, e.lngLat);
      setPinned(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Only ever constructed once — `center` seeds the initial view only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drop/move a marker at the active location without re-creating the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      markerRef.current = new Marker({ color: "#4ade80" });
    }
    markerRef.current.setLngLat([center.lon, center.lat]).addTo(map);
    if (!pinned) {
      map.easeTo({ center: [center.lon, center.lat], duration: 400 });
    }
  }, [center, pinned]);

  return <div ref={containerRef} className="h-full w-full" />;
}
