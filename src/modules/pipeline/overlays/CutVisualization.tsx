import { useEffect, useState } from "react";

interface CutVisualizationProps {
  isCutting: boolean;
  isClosingCut: boolean;
  cutPath: { x: number; y: number }[];
}

const SWEEP_MS = 380;
const GLINT_LENGTH = 56;
const TAIL_WIDTH = 1;
const HEAD_WIDTH = 9;
const TIP_LENGTH = 18;
/** Belly of the katana tip, both measured along the blade and off its axis. */
const TIP_BELLY_ALONG = 6;
const TIP_BELLY_OFFSET = 7.2;

/** A tapered band: thin at `a`, wide at `b`. */
function ribbon(
  a: { x: number; y: number },
  b: { x: number; y: number },
  widthAtA: number,
  widthAtB: number,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const at = (p: { x: number; y: number }, w: number) =>
    `${(p.x + nx * w).toFixed(2)},${(p.y + ny * w).toFixed(2)}`;
  const other = (p: { x: number; y: number }, w: number) =>
    `${(p.x - nx * w).toFixed(2)},${(p.y - ny * w).toFixed(2)}`;

  return [
    at(a, widthAtA / 2),
    at(b, widthAtB / 2),
    other(b, widthAtB / 2),
    other(a, widthAtA / 2),
  ].join(" ");
}

/**
 * The cut stroke: a straight, tapered blade in the current theme colour.
 * The tail is 1px, the head 9px, and the last 18px form a katana tip — one
 * curved belly, one straight spine, apex at the pointer. A 56px highlight
 * sweeps from the tail to the head once per gesture. No filters, no gradients.
 */
export function CutVisualization({
  isCutting,
  isClosingCut,
  cutPath,
}: CutVisualizationProps) {
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    if (!isCutting) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setSweep(1);
      return;
    }

    setSweep(0);
    let raf = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / SWEEP_MS);
      setSweep(progress);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isCutting]);

  if ((!isCutting && !isClosingCut) || cutPath.length <= 1) return null;

  const start = cutPath[0];
  const end = cutPath[cutPath.length - 1];
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 1) return null;

  const dirX = (end.x - start.x) / length;
  const dirY = (end.y - start.y) / length;
  const normalX = -dirY;
  const normalY = dirX;
  // The body stops short of the pointer so the last 12px form a pointed tip.
  const tipLength = Math.min(TIP_LENGTH, length * 0.35);
  const headBase = {
    x: end.x - dirX * tipLength,
    y: end.y - dirY * tipLength,
  };
  const halfHead = HEAD_WIDTH / 2;
  const tipLeft = {
    x: headBase.x + normalX * halfHead,
    y: headBase.y + normalY * halfHead,
  };
  const tipRight = {
    x: headBase.x - normalX * halfHead,
    y: headBase.y - normalY * halfHead,
  };
  const belly = {
    x: end.x - dirX * TIP_BELLY_ALONG + normalX * TIP_BELLY_OFFSET,
    y: end.y - dirY * TIP_BELLY_ALONG + normalY * TIP_BELLY_OFFSET,
  };
  // Katana tip: one curved belly, one straight spine, apex at the pointer.
  const tipPath =
    `M ${tipLeft.x.toFixed(2)} ${tipLeft.y.toFixed(2)} ` +
    `Q ${belly.x.toFixed(2)} ${belly.y.toFixed(2)} ` +
    `${end.x.toFixed(2)} ${end.y.toFixed(2)} ` +
    `L ${tipRight.x.toFixed(2)} ${tipRight.y.toFixed(2)} Z`;

  const coreStart = {
    x: start.x + (end.x - start.x) * 0.52,
    y: start.y + (end.y - start.y) * 0.52,
  };
  const glintLength = Math.min(GLINT_LENGTH, length * 0.45);
  const glintT = Math.max(
    glintLength / length,
    Math.min(1, sweep * (1 + glintLength / length)),
  );
  const glintHead = {
    x: start.x + (end.x - start.x) * glintT,
    y: start.y + (end.y - start.y) * glintT,
  };
  const glintTail = {
    x: start.x + (end.x - start.x) * (glintT - glintLength / length),
    y: start.y + (end.y - start.y) * (glintT - glintLength / length),
  };

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1000,
      }}
      aria-hidden="true"
    >
      <g className={isClosingCut ? "cut-visual-closing" : undefined}>
        <polygon
          className="cut-blade-body"
          points={ribbon(start, headBase, TAIL_WIDTH, HEAD_WIDTH)}
        />
        <polygon
          className="cut-blade-core"
          points={ribbon(coreStart, headBase, 0.4, 3.6)}
        />
        <polygon
          className="cut-blade-glint"
          points={ribbon(glintTail, glintHead, 0, 3)}
        />
        <path className="cut-blade-tip" d={tipPath} />
      </g>
    </svg>
  );
}
