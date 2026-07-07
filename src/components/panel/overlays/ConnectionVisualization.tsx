import { useLanguage } from "@/i18n";

interface ConnectionVisualizationProps {
  isConnecting: boolean;
  connectPath: { x: number; y: number }[];
  connectTargetNode: string | null;
}

export function ConnectionVisualization({ isConnecting, connectPath, connectTargetNode }: ConnectionVisualizationProps) {
  const { t } = useLanguage();

  if (!isConnecting || connectPath.length === 0) return null;

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
        <linearGradient id="connectGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--flow-line-color)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--flow-line-color), transparent 50%)" />
        </linearGradient>
      </defs>

      {/* 连接线 */}
      {connectPath.length > 1 && (
        <path
          d={`M ${connectPath[0].x} ${connectPath[0].y} ${connectPath
            .slice(1)
            .map(p => `L ${p.x} ${p.y}`)
            .join(' ')}`}
          stroke="url(#connectGradient)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8 4"
        />
      )}

      {/* 起点标记 */}
      <circle
        cx={connectPath[0]?.x || 0}
        cy={connectPath[0]?.y || 0}
        r="8"
        fill="var(--flow-line-color)"
        opacity="0.8"
      />

      {/* 目标节点高亮 */}
      {connectTargetNode && (
        <text
          x={connectPath[connectPath.length - 1]?.x || 0}
          y={(connectPath[connectPath.length - 1]?.y || 0) - 20}
          fill="var(--flow-line-color)"
          fontSize="12"
          textAnchor="middle"
        >
          {t.connectionTips}
        </text>
      )}
    </svg>
  );
}
