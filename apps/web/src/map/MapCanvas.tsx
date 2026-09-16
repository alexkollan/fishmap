import { useEffect, useRef, useState } from "react";
import { Map as MaplibreMap, Marker, NavigationControl, setWorkerUrl, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ActiveLocation } from "@fishmap/types";

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
  onTap: (lngLat: { lng: number; lat: number }) => void;
}

export function MapCanvas({ center, onReady, onTap }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [pinned, setPinned] = useState(false);
  // State, not just the ref, so the marker effect below re-runs once the
  // style has loaded. Without it the marker was simply never placed on
  // arrival: the effect runs before `load` fires, bails on a null map, and
  // then has no reason to run again because `center` hasn't changed since.
  // It only ever appeared if you moved the pin yourself — which stopped
  // being acceptable when the map became the landing route and the pin
  // became the whole point.
  const [ready, setReady] = useState(false);

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
      setReady(true);
      onReady(map);
    });

    map.on("click", (e: MapMouseEvent) => {
      onTap(e.lngLat);
      setPinned(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Only ever constructed once — `center` seeds the initial view only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drop/move a marker at the active location without re-creating the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!markerRef.current) {
      markerRef.current = new Marker({ color: "#4ade80" });
    }
    markerRef.current.setLngLat([center.lon, center.lat]).addTo(map);
    if (!pinned) {
      map.easeTo({ center: [center.lon, center.lat], duration: 400 });
    }
  }, [center, pinned, ready]);

  return <div ref={containerRef} className="h-full w-full" />;
}
