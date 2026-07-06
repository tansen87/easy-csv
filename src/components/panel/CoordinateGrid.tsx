import { useMemo } from "react";
import { useStore } from "reactflow";

const MAJOR = 200;
const MINOR = 50;
const TICK = 8;
const LABEL_PAD = 14;

export function CoordinateGrid() {
  const [vx, vy, zoom] = useStore((s) => s.transform);

  const W = typeof window !== "undefined" ? window.innerWidth : 1920;
  const H = typeof window !== "undefined" ? window.innerHeight : 1080;

  const data = useMemo(() => {
    // visible world bounds
    const wX0 = -vx / zoom;
    const wX1 = (W - vx) / zoom;
    const wY0 = -vy / zoom;
    const wY1 = (H - vy) / zoom;

    // major lines: world coord -> screen X/Y
    const mV: number[] = [];
    for (let wx = Math.floor(wX0 / MAJOR) * MAJOR; wx <= wX1; wx += MAJOR)
      if (wx !== 0) mV.push(wx);
    const mH: number[] = [];
    for (let wy = Math.floor(wY0 / MAJOR) * MAJOR; wy <= wY1; wy += MAJOR)
      if (wy !== 0) mH.push(wy);

    // minor lines
    const nV: number[] = [];
    for (let wx = Math.floor(wX0 / MINOR) * MINOR; wx <= wX1; wx += MINOR)
      if (wx % MAJOR !== 0) nV.push(wx);
    const nH: number[] = [];
    for (let wy = Math.floor(wY0 / MINOR) * MINOR; wy <= wY1; wy += MINOR)
      if (wy % MAJOR !== 0) nH.push(wy);

    return { mV, mH, nV, nH, wY0, wY1, wX0, wX1 };
  }, [vx, vy, zoom, W, H]);

  const s = "var(--muted-foreground)";

  return (
    <svg className="coordinate-grid" width={W} height={H} style={{ pointerEvents: "none" }}>
      {/* Minor vertical lines */}
      {data.nV.map((wx) => {
        const sx = vx + wx * zoom;
        return (
          <line key={`nv${wx}`} x1={sx} y1={0} x2={sx} y2={H}
            stroke={s} strokeOpacity={0.06} strokeWidth={1} />
        );
      })}
      {/* Minor horizontal lines */}
      {data.nH.map((wy) => {
        const sy = vy + wy * zoom;
        return (
          <line key={`nh${wy}`} x1={0} y1={sy} x2={W} y2={sy}
            stroke={s} strokeOpacity={0.06} strokeWidth={1} />
        );
      })}
      {/* Major vertical lines */}
      {data.mV.map((wx) => {
        const sx = vx + wx * zoom;
        return (
          <line key={`mv${wx}`} x1={sx} y1={0} x2={sx} y2={H}
            stroke={s} strokeOpacity={0.12} strokeWidth={1} />
        );
      })}
      {/* Major horizontal lines */}
      {data.mH.map((wy) => {
        const sy = vy + wy * zoom;
        return (
          <line key={`mh${wy}`} x1={0} y1={sy} x2={W} y2={sy}
            stroke={s} strokeOpacity={0.12} strokeWidth={1} />
        );
      })}
      {/* X-axis (horizontal at world y=0) */}
      <line x1={0} y1={vy} x2={W} y2={vy}
        stroke={s} strokeOpacity={0.5} strokeWidth={1.5} />
      {/* Y-axis (vertical at world x=0) */}
      <line x1={vx} y1={0} x2={vx} y2={H}
        stroke={s} strokeOpacity={0.5} strokeWidth={1.5} />
      {/* X-axis ticks + labels */}
      {data.mV.map((wx) => {
        const sx = vx + wx * zoom;
        return (
          <g key={`tx${wx}`}>
            <line x1={sx} y1={vy} x2={sx} y2={vy + TICK}
              stroke={s} strokeOpacity={0.3} strokeWidth={1.5} />
            <text x={sx} y={vy + TICK + LABEL_PAD}
              textAnchor="middle" fill={s} fillOpacity={0.45}
              fontSize={10} fontFamily="var(--font-sans)"
              style={{ userSelect: "none" }}>
              {wx}
            </text>
          </g>
        );
      })}
      {/* Y-axis ticks + labels */}
      {data.mH.map((wy) => {
        const sy = vy + wy * zoom;
        return (
          <g key={`ty${wy}`}>
            <line x1={vx} y1={sy} x2={vx + TICK} y2={sy}
              stroke={s} strokeOpacity={0.3} strokeWidth={1.5} />
            <text x={vx + TICK + LABEL_PAD} y={sy}
              dominantBaseline="middle" fill={s} fillOpacity={0.45}
              fontSize={10} fontFamily="var(--font-sans)"
              style={{ userSelect: "none" }}>
              {wy}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
