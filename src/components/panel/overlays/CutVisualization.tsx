interface CutVisualizationProps {
  isCutting: boolean;
  isClosingCut: boolean;
  cutPath: { x: number; y: number }[];
}

export function CutVisualization({ isCutting, isClosingCut, cutPath }: CutVisualizationProps) {
  if ((!isCutting && !isClosingCut) || cutPath.length <= 1) return null;

  const start = cutPath[0];
  const end = cutPath[cutPath.length - 1];
  const arrowSize = 12;

  // 菱形顶点计算
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / length;
  const ny = dy / length;

  // 垂直于线段的方向
  const perpX = -ny;
  const perpY = nx;

  // 菱形四个顶点
  const p1x = end.x + nx * arrowSize;
  const p1y = end.y + ny * arrowSize;
  const p2x = end.x + perpX * arrowSize * 0.5;
  const p2y = end.y + perpY * arrowSize * 0.5;
  const p3x = end.x - nx * arrowSize * 1.5;
  const p3y = end.y - ny * arrowSize * 1.5;
  const p4x = end.x - perpX * arrowSize * 0.5;
  const p4y = end.y - perpY * arrowSize * 0.5;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <defs>
        {/* 渐变从透明到红色再到透明 */}
        <linearGradient id="cutGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="30%" stopColor="rgba(255, 200, 200, 0.3)" />
          <stop offset="70%" stopColor="rgba(239, 68, 68, 0.8)" />
          <stop offset="100%" stopColor="rgba(255, 150, 100, 0)" />
        </linearGradient>

        {/* 主色渐变 */}
        <linearGradient id="cutMainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(200, 200, 200, 0)" />
          <stop offset="50%" stopColor="rgba(255, 100, 100, 0.9)" />
          <stop offset="100%" stopColor="rgba(255, 180, 120, 0)" />
        </linearGradient>

        <filter id="cutGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 箭头标记 */}
        <marker id="cutArrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
          <polygon
            points="0,0 12,6 0,12"
            fill="rgba(239, 68, 68, 0.8)"
            filter="url(#cutGlow)"
          />
        </marker>
      </defs>

      {/* 外层光晕 */}
      <path
        d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
        stroke="rgba(255, 150, 150, 0.3)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="butt"
        style={{
          transition: isClosingCut ? 'all 0.15s ease-out' : 'none',
          opacity: isClosingCut ? 0 : 1,
        }}
      />

      {/* 主线条 */}
      <path
        d={`M ${start.x} ${start.y} L ${end.x - nx * arrowSize * 0.8} ${end.y - ny * arrowSize * 0.8}`}
        stroke="url(#cutMainGradient)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="butt"
        filter="url(#cutGlow)"
        style={{
          transition: isClosingCut ? 'all 0.15s ease-out' : 'none',
          opacity: isClosingCut ? 0 : 1,
        }}
      />

      {/* 终点菱形 */}
      <polygon
        points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`}
        fill="rgba(239, 68, 68, 0.7)"
        stroke="rgba(255, 100, 100, 0.9)"
        strokeWidth="1"
        filter="url(#cutGlow)"
      />

      {/* 菱形高光 */}
      <polygon
        points={`${p1x},${p1y} ${p2x},${p2y} ${end.x},${end.y} ${p4x},${p4y}`}
        fill="rgba(255, 255, 255, 0.4)"
      />

      {/* 起点发光点 - 收刀时平滑移动到终点 */}
      <circle
        cx={start.x}
        cy={start.y}
        r="3"
        fill="rgba(255, 255, 255, 0.8)"
        filter="url(#cutGlow)"
        style={{
          transition: isClosingCut ? 'cx 0.15s ease-out, cy 0.15s ease-out, r 0.15s ease-out' : 'none',
          ...(isClosingCut ? {
            cx: end.x,
            cy: end.y,
            r: 0,
          } : {}),
        }}
      />
    </svg>
  );
}
