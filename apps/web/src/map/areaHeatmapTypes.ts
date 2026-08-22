export interface AreaGridResponse {
  step: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  nx: number;
  ny: number;
  hourTs: string | null;
  factors: Record<string, (number | null)[]>;
}

export type ToAreaWorkerMessage = { type: "render"; grid: AreaGridResponse; factorKey: string };
export type FromAreaWorkerMessage = { type: "bitmap"; bitmap: ImageBitmap; bbox: [number, number, number, number] };
