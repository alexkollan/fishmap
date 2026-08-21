import { useId } from "react";

interface MoonIconProps {
  phase: number; // 0 = new, 0.5 = full (SunCalc convention)
  size?: number;
}

// Standard terminator-ellipse construction: the lit region is bounded by a
// fixed outer semicircle (whichever side is waxing/waning) and a terminator
// half-ellipse whose horizontal radius is r*|cos(2π·phase)|, bulging the
// same side as the outer limb pre-quarter (crescent, subtracting) and the
// opposite side post-quarter (gibbous, adding).
export function MoonIcon({ phase, size = 72 }: MoonIconProps) {
  const clipId = useId();
  const r = size / 2;
  const theta = phase * Math.PI * 2;
  const rx = Math.abs(r * Math.cos(theta));
  const waxing = phase < 0.5;
  const gibbous = phase >= 0.25 && phase <= 0.75;
  const outerSweep = waxing ? 1 : 0;
  const terminatorSweep = gibbous ? (waxing ? 0 : 1) : outerSweep;
  const d = `M ${r},0 A ${r},${r} 0 0 ${outerSweep} ${r},${size} A ${rx},${r} 0 0 ${terminatorSweep} ${r},0`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Moon phase">
      <defs>
        <clipPath id={clipId}>
          <circle cx={r} cy={r} r={r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={size} height={size} fill="#141c21" />
        <path d={d} fill="#e8edf0" />
      </g>
      <circle cx={r} cy={r} r={r - 0.5} fill="none" stroke="rgba(255,255,255,0.15)" />
    </svg>
  );
}
