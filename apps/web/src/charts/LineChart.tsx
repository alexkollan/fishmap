import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export interface LineChartSeries {
  label: string;
  color: string;
  data: (number | null)[];
}

interface LineChartProps {
  /** Unix seconds, one per data point, ascending. */
  times: number[];
  series: LineChartSeries[];
  height?: number;
  unit?: string;
  /** IANA zone for x-axis tick labels — v1 is Greek-coastline-only, so this
   * defaults to Athens rather than the viewer's browser timezone. */
  timeZone?: string;
}

const AXIS_STROKE = "#8fa1a8";
const GRID_STROKE = "rgba(255,255,255,0.08)";

function timeAxisFormatter(timeZone: string) {
  const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit" });
  const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  // Only stamp the date at the first tick or when the local day changes —
  // every tick showing "21/08, 14:00" is wider than uPlot's default spacing
  // expects and the labels collide.
  return (_u: uPlot, splits: number[]) =>
    splits.map((s, i) => {
      const d = new Date(s * 1000);
      if (i === 0 || dayFmt.format(d) !== dayFmt.format(new Date(splits[i - 1]! * 1000))) {
        return `${dayFmt.format(d)} ${hourFmt.format(d)}`;
      }
      return hourFmt.format(d);
    });
}

// uPlot (~40 KB, DEV_PLAN.md §5.6) over Recharts/Chart.js for the frame
// budget. Only imported on routes that chart, never in the shared bundle.
export function LineChart({ times, series, height = 180, unit, timeZone = "Europe/Athens" }: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const data = [times, ...series.map((s) => s.data)] as uPlot.AlignedData;

    const opts: uPlot.Options = {
      width: container.clientWidth,
      height,
      padding: [8, 8, 0, 0],
      series: [
        {},
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 2,
          points: { show: false },
        })),
      ],
      axes: [
        { stroke: AXIS_STROKE, grid: { stroke: GRID_STROKE }, values: timeAxisFormatter(timeZone), space: 80 },
        {
          stroke: AXIS_STROKE,
          grid: { stroke: GRID_STROKE },
          values: unit ? (_u: uPlot, vals: number[]) => vals.map((v) => `${v}${unit}`) : undefined,
        },
      ],
      cursor: { show: true },
      legend: { show: series.length > 1 },
    };

    plotRef.current = new uPlot(opts, data, container);

    const onResize = () => {
      if (container && plotRef.current) {
        plotRef.current.setSize({ width: container.clientWidth, height });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [times, series, height, unit, timeZone]);

  return <div ref={containerRef} className="w-full overflow-hidden" />;
}
