// Static output of tools/coastline-pipeline (DEV_PLAN.md §5.1, scoped down —
// see PROGRESS.md: plain GeoJSON + setFeatureState instead of MVT tiles,
// since tippecanoe isn't available in this environment).
export interface CoastlineFeatureProps {
  id: number;
  aspectDeg: number;
  lengthKm: number;
  lat: number;
  lon: number;
  gridLat: number;
  gridLon: number;
}

export interface CoastlineFeature {
  type: "Feature";
  id: number;
  properties: CoastlineFeatureProps;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface CoastlineCollection {
  type: "FeatureCollection";
  features: CoastlineFeature[];
}

export async function loadCoastline(signal?: AbortSignal): Promise<CoastlineCollection> {
  const res = await fetch("/data/coastline.geojson", { signal });
  if (!res.ok) throw new Error(`Failed to load coastline data: ${res.status}`);
  return res.json() as Promise<CoastlineCollection>;
}

export function gridKeyOf(props: Pick<CoastlineFeatureProps, "gridLat" | "gridLon">): string {
  return `${props.gridLat.toFixed(2)},${props.gridLon.toFixed(2)}`;
}
