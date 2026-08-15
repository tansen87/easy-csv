interface ConnectionVisualizationProps {
  isConnecting: boolean;
  connectPreviewD: string | null;
  connectStartAnchor: { x: number; y: number } | null;
  connectEndAnchor: { x: number; y: number } | null;
  connectTargetNode: string | null;
}

export function ConnectionVisualization({
  isConnecting,
  connectPreviewD,
  connectStartAnchor,
}: ConnectionVisualizationProps) {
  if (!isConnecting || !connectPreviewD) return null;

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
    >
      <defs>
        <linearGradient id="connectGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--flow-line-color)" />
          <stop
            offset="100%"
            stopColor="color-mix(in oklch, var(--flow-line-color), transparent 50%)"
          />
        </linearGradient>
        <marker
          id="connectArrow"
          markerWidth="8"
          markerHeight="8"
          refX="5"
          refY="2"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,4 L6,2 z" fill="var(--flow-line-color)" />
        </marker>
      </defs>

      {/* 贝塞尔连接线 */}
      <path
        d={connectPreviewD}
        stroke="url(#connectGradient)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        markerEnd="url(#connectArrow)"
      />

      {/* 起点标记 */}
      {connectStartAnchor && (
        <circle
          cx={connectStartAnchor.x}
          cy={connectStartAnchor.y}
          r="8"
          fill="var(--flow-line-color)"
          opacity="0.8"
        />
      )}
    </svg>
  );
}
