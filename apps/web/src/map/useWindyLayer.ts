import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ImageSource, Map as MaplibreMap } from "maplibre-gl";
import { fetchVectorField, GridField, currentToFromBearing, pressureToColor, type VectorFieldResponse } from "./windyField";
import { WindParticleLayer, type VectorSample } from "./particleLayer";
import { OVERLAY_LAYER_IDS } from "./useMapLayers";

export type ParticleMode = "off" | "wind" | "current";

interface WindyLayerStore {
  particleMode: ParticleMode;
  setParticleMode: (mode: ParticleMode) => void;
  pressureOn: boolean;
  togglePressure: () => void;
}

// Same persistence convention as useMapLayers.ts's overlay toggles
// (DEV_PLAN.md §6.4: "the app opens the way it was left").
const useWindyStore = create<WindyLayerStore>()(
  persist(
    (set) => ({
      particleMode: "off",
      setParticleMode: (mode) => set({ particleMode: mode }),
      pressureOn: false,
      togglePressure: () => set((s) => ({ pressureOn: !s.pressureOn })),
    }),
    { name: "fishmap:windy-layer" },
  ),
);

const PARTICLE_LAYER_ID = "windy-particles";
const PRESSURE_SOURCE_ID = "windy-pressure";
const PRESSURE_LAYER_ID = "windy-pressure-layer";
const BLANK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

// Wind reads in a green-cyan tint, current in amber — matches score.ts's
// existing color language (green=good) loosely without implying a score.
const WIND_COLOR: [number, number, number] = [0.35, 0.85, 0.65];
const CURRENT_COLOR: [number, number, number] = [0.95, 0.7, 0.25];

interface Samplers {
  wind: (lon: number, lat: number) => VectorSample | null;
  current: (lon: number, lat: number) => VectorSample | null;
}

function buildSamplers(field: VectorFieldResponse): Samplers {
  const grid = new GridField(field.bbox, field.nx, field.ny, field.step);
  // Ocean current uses the oceanographic "to" convention, opposite of wind's
  // meteorological "from" — convert once so sampleVector's shared
  // u/v-decomposition math (which assumes "from") is correct for both.
  const currentDirectionFrom = field.current.direction.map((d) => (d === null ? null : currentToFromBearing(d)));
  return {
    wind: (lon, lat) => grid.sampleVector(field.wind.speed, field.wind.direction, lon, lat),
    current: (lon, lat) => grid.sampleVector(field.current.speed, currentDirectionFrom, lon, lat),
  };
}

function buildPressureCanvas(field: VectorFieldResponse): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = field.nx;
  canvas.height = field.ny;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(field.nx, field.ny);
  for (let row = 0; row < field.ny; row++) {
    // Data is row-major south-to-north (row 0 = minLat) but canvas row 0 is
    // visually the top (= maxLat) — flip.
    const canvasRow = field.ny - 1 - row;
    for (let col = 0; col < field.nx; col++) {
      const value = field.pressure[row * field.nx + col];
      const pixelIndex = (canvasRow * field.nx + col) * 4;
      if (value == null) {
        image.data[pixelIndex + 3] = 0;
        continue;
      }
      const [r, g, b] = pressureToColor(value);
      image.data[pixelIndex] = r;
      image.data[pixelIndex + 1] = g;
      image.data[pixelIndex + 2] = b;
      image.data[pixelIndex + 3] = 150;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Wires the wind/current particle layer + pressure gradient layer onto the
 * map — purely visual (Windy-style), unrelated to scoring. Publicly
 * available to every visitor (not gated behind the `windParticles` admin
 * flag — that was this feature's original default, deliberately removed per
 * explicit user direction, see PROGRESS.md). Data isn't fetched unless the
 * visitor actually toggles particles or pressure on.
 */
export function useWindyLayer(map: MaplibreMap | null) {
  const particleMode = useWindyStore((s) => s.particleMode);
  const setParticleMode = useWindyStore((s) => s.setParticleMode);
  const pressureOn = useWindyStore((s) => s.pressureOn);
  const togglePressure = useWindyStore((s) => s.togglePressure);

  const wantsData = particleMode !== "off" || pressureOn;
  const { data: field } = useQuery({
    queryKey: ["vectorField"],
    queryFn: fetchVectorField,
    enabled: wantsData,
    staleTime: 60 * 60 * 1000, // roughly matches the 6h backend refresh cadence loosely
    refetchInterval: 60 * 60 * 1000,
  });

  const samplers = useMemo(() => (field ? buildSamplers(field) : null), [field]);
  const particleLayerRef = useRef<WindParticleLayer | null>(null);

  // Create/destroy the particle custom layer as particleMode toggles
  // to/from "off". Mode swaps (wind<->current) while already active are
  // handled by the effect below via in-place sample/color mutation, not a
  // remove+re-add — cheaper and avoids a visual flicker of GL state tearing
  // down mid-animation.
  useEffect(() => {
    if (!map || !field || !samplers) return;
    const wantsParticles = particleMode !== "off";
    const hasLayer = !!particleLayerRef.current;

    if (wantsParticles && !hasLayer) {
      const layer = new WindParticleLayer({
        id: PARTICLE_LAYER_ID,
        bbox: field.bbox,
        sample: particleMode === "current" ? samplers.current : samplers.wind,
        color: particleMode === "current" ? CURRENT_COLOR : WIND_COLOR,
      });
      particleLayerRef.current = layer;
      map.addLayer(layer);
    } else if (!wantsParticles && hasLayer) {
      if (map.getLayer(PARTICLE_LAYER_ID)) map.removeLayer(PARTICLE_LAYER_ID);
      particleLayerRef.current = null;
    }
  }, [map, field, samplers, particleMode]);

  // Keep an already-active particle layer's sample fn + color in sync with
  // the latest fetch and the selected mode, without touching GL layer
  // lifecycle (handled above).
  useEffect(() => {
    const layer = particleLayerRef.current;
    if (!layer || !samplers) return;
    layer.setSample(particleMode === "current" ? samplers.current : samplers.wind);
    layer.color = particleMode === "current" ? CURRENT_COLOR : WIND_COLOR;
  }, [samplers, particleMode]);

  // Add/update/remove the pressure gradient image layer.
  useEffect(() => {
    if (!map) return;

    if (!pressureOn || !field) {
      if (map.getLayer(PRESSURE_LAYER_ID)) map.removeLayer(PRESSURE_LAYER_ID);
      if (map.getSource(PRESSURE_SOURCE_ID)) map.removeSource(PRESSURE_SOURCE_ID);
      return;
    }

    const [minLon, minLat, maxLon, maxLat] = field.bbox;
    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [minLon, maxLat],
      [maxLon, maxLat],
      [maxLon, minLat],
      [minLon, minLat],
    ];
    const canvas = buildPressureCanvas(field);

    if (!map.getSource(PRESSURE_SOURCE_ID)) {
      map.addSource(PRESSURE_SOURCE_ID, { type: "image", url: BLANK_PNG, coordinates });
    }
    if (!map.getLayer(PRESSURE_LAYER_ID)) {
      const beforeId = OVERLAY_LAYER_IDS.find((id) => map.getLayer(id));
      map.addLayer(
        { id: PRESSURE_LAYER_ID, type: "raster", source: PRESSURE_SOURCE_ID, paint: { "raster-resampling": "linear", "raster-opacity": 0.6 } },
        beforeId,
      );
    }
    (map.getSource(PRESSURE_SOURCE_ID) as ImageSource).updateImage({ image: canvas });
  }, [map, field, pressureOn]);

  // Full teardown on unmount (map disappearing entirely, not just a toggle).
  useEffect(() => {
    return () => {
      if (!map) return;
      if (map.getLayer(PARTICLE_LAYER_ID)) map.removeLayer(PARTICLE_LAYER_ID);
      if (map.getLayer(PRESSURE_LAYER_ID)) map.removeLayer(PRESSURE_LAYER_ID);
      if (map.getSource(PRESSURE_SOURCE_ID)) map.removeSource(PRESSURE_SOURCE_ID);
    };
  }, [map]);

  return { particleMode, setParticleMode, pressureOn, togglePressure };
}
