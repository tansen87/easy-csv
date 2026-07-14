interface CutVisualizationProps {
  isCutting: boolean;
  isClosingCut: boolean;
  cutPath: { x: number; y: number }[];
}

export function CutVisualization({ isCutting, isClosingCut, cutPath }: CutVisualizationProps) {
  if ((!isCutting && !isClosingCut) || cutPath.length <= 1) return null;

  const start = cutPath[0];
  const end = cutPath[cutPath.length - 1];

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 1) return null;

  const nx = dx / length;
  const ny = dy / length;
  const perpX = -ny;
  const perpY = nx;

  // 刀刃菱形参数
  const arrowLen = 14;
  const arrowW = 5;

  const tipX = end.x + nx * arrowLen;
  const tipY = end.y + ny * arrowLen;
  const leftX = end.x + perpX * arrowW;
  const leftY = end.y + perpY * arrowW;
  const tailX = end.x - nx * arrowLen * 0.4;
  const tailY = end.y - ny * arrowLen * 0.4;
  const rightX = end.x - perpX * arrowW;
  const rightY = end.y - perpY * arrowW;

  // 刀刃高光三角
  const hlLeftX = end.x + perpX * arrowW * 0.6;
  const hlLeftY = end.y + perpY * arrowW * 0.6;
  const hlRightX = end.x - perpX * arrowW * 0.2;
  const hlRightY = end.y - perpY * arrowW * 0.2;

  const closing = isClosingCut;

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
        {/* 灰色系渐变 - 刀刃金属质感 */}
        <linearGradient id="cutBladeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(180, 180, 190, 0)" />
          <stop offset="25%" stopColor="rgba(160, 160, 170, 0.6)" />
          <stop offset="60%" stopColor="rgba(200, 200, 210, 0.9)" />
          <stop offset="100%" stopColor="rgba(220, 220, 230, 0)" />
        </linearGradient>

        {/* 外层光晕渐变 */}
        <linearGradient id="cutGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(200, 200, 210, 0)" />
          <stop offset="40%" stopColor="rgba(180, 180, 195, 0.15)" />
          <stop offset="80%" stopColor="rgba(190, 190, 200, 0.25)" />
          <stop offset="100%" stopColor="rgba(200, 200, 210, 0)" />
        </linearGradient>

        {/* 刀刃填充渐变 - 金属钢灰 */}
        <linearGradient id="cutDiamondGrad" x1="0%" y1="0%" x2="1" y2="1">
          <stop offset="0%" stopColor="#b8b8c0" />
          <stop offset="50%" stopColor="#9a9aa6" />
          <stop offset="100%" stopColor="#7c7c88" />
        </linearGradient>

        {/* 柔和辉光 */}
        <filter id="cutSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 强辉光 - 用于刀刃 */}
        <filter id="cutBladeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 外层扩散光晕 */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="rgba(180, 180, 195, 0.2)"
        strokeWidth="10"
        strokeLinecap="round"
        filter="url(#cutSoftGlow)"
        style={{
          transition: closing ? 'opacity 0.15s ease-out' : 'none',
          opacity: closing ? 0 : 1,
        }}
      />

      {/* 中层光晕 */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="rgba(190, 190, 200, 0.35)"
        strokeWidth="4"
        strokeLinecap="round"
        style={{
          transition: closing ? 'opacity 0.15s ease-out' : 'none',
          opacity: closing ? 0 : 1,
        }}
      />

      {/* 主刀刃线条 */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x - nx * arrowLen * 0.3}
        y2={end.y - ny * arrowLen * 0.3}
        stroke="url(#cutBladeGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#cutSoftGlow)"
        style={{
          transition: closing ? 'opacity 0.15s ease-out' : 'none',
          opacity: closing ? 0 : 1,
        }}
      />

      {/* 刀刃高光线 */}
      <line
        x1={start.x + (end.x - start.x) * 0.2}
        y1={start.y + (end.y - start.y) * 0.2}
        x2={end.x - nx * arrowLen * 0.5}
        y2={end.y - ny * arrowLen * 0.5}
        stroke="rgba(220, 220, 235, 0.5)"
        strokeWidth="0.8"
        strokeLinecap="round"
        style={{
          transition: closing ? 'opacity 0.15s ease-out' : 'none',
          opacity: closing ? 0 : 1,
        }}
      />

      {/* 刀刃菱形 - 金属钢灰 */}
      <polygon
        points={`${tipX},${tipY} ${leftX},${leftY} ${tailX},${tailY} ${rightX},${rightY}`}
        fill="url(#cutDiamondGrad)"
        stroke="rgba(140, 140, 155, 0.9)"
        strokeWidth="1"
        filter="url(#cutBladeGlow)"
        style={{
          transition: closing ? 'opacity 0.15s ease-out, transform 0.15s ease-out' : 'none',
          opacity: closing ? 0 : 1,
          transformOrigin: `${end.x}px ${end.y}px`,
          transform: closing ? 'scale(0.5)' : 'scale(1)',
        }}
      />

      {/* 刀刃高光三角 - 金属反光 */}
      <polygon
        points={`${tipX},${tipY} ${hlLeftX},${hlLeftY} ${hlRightX},${hlRightY}`}
        fill="rgba(230, 230, 240, 0.45)"
        style={{
          transition: closing ? 'opacity 0.15s ease-out' : 'none',
          opacity: closing ? 0 : 1,
        }}
      />

      {/* 刀尖亮点 */}
      <circle
        cx={tipX}
        cy={tipY}
        r="2"
        fill="rgba(240, 240, 250, 0.9)"
        filter="url(#cutSoftGlow)"
        style={{
          transition: closing ? 'opacity 0.12s ease-out, r 0.12s ease-out' : 'none',
          opacity: closing ? 0 : 1,
        }}
      />

      {/* 起点发光 - 收刀时滑向终点 */}
      <circle
        cx={start.x}
        cy={start.y}
        r="2.5"
        fill="rgba(210, 210, 220, 0.7)"
        filter="url(#cutSoftGlow)"
        style={{
          transition: closing
            ? 'cx 0.15s ease-out, cy 0.15s ease-out, r 0.15s ease-out, opacity 0.15s ease-out'
            : 'none',
          ...(closing ? { cx: end.x, cy: end.y, r: 0, opacity: 0 } : {}),
        }}
      />
    </svg>
  );
}
