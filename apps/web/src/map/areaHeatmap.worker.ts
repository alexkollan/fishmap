// Renders the backend's precomputed area score grid (GET /api/scores/area)
// as a small color image, one pixel per grid cell. MapLibre's raster layer
// (raster-resampling: "linear" — see useAreaScoreGrid.ts) does the actual
// smoothing via GPU texture filtering when it stretches this coarse image
// across the full map viewport, so there's no manual interpolation here —
// this worker only exists to keep the pixel loop off the main thread while
// scrubbing.
import { scoreToColor } from "./scoreColor";
import type { FromAreaWorkerMessage, ToAreaWorkerMessage } from "./areaHeatmapTypes";

self.onmessage = (event: MessageEvent<ToAreaWorkerMessage>) => {
  const { grid, factorKey } = event.data;
  const values = grid.factors[factorKey];
  if (!values) return;

  const canvas = new OffscreenCanvas(grid.nx, grid.ny);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const imageData = ctx.createImageData(grid.nx, grid.ny);
  // Data is row-major south-to-north (row 0 = minLat), but image row 0 is
  // the *top* of the picture — which the "image" source's coordinates
  // (useAreaScoreGrid.ts) put at maxLat. Flip vertically while writing.
  for (let row = 0; row < grid.ny; row++) {
    const canvasRow = grid.ny - 1 - row;
    for (let col = 0; col < grid.nx; col++) {
      const score = values[row * grid.nx + col];
      const pixelIndex = (canvasRow * grid.nx + col) * 4;
      if (score === null || score === undefined) continue; // stays transparent
      const [r, g, b] = scoreToColor(score);
      imageData.data[pixelIndex] = r;
      imageData.data[pixelIndex + 1] = g;
      imageData.data[pixelIndex + 2] = b;
      imageData.data[pixelIndex + 3] = 165; // translucent, like a weather overlay
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const bitmap = canvas.transferToImageBitmap();
  const response: FromAreaWorkerMessage = { type: "bitmap", bitmap, bbox: grid.bbox };
  (self as unknown as Worker).postMessage(response, [bitmap]);
};
