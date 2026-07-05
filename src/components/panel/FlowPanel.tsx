import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  MarkerType,
  Connection,
  Handle,
  Position,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, Edit3, Check, Settings, Search, Terminal, X } from "lucide-react";
import { commandIconMap } from "@/components/CommandList";
import { CoordinateGrid } from "@/components/panel/CoordinateGrid";
import { PipelineStep, PipelineEdge } from "@/types/xan";
import { ContextMenu } from "@/components/menu/ContextMenu";
import { TextTransformType } from "@/components/dialog/TextTransformDialog";
import { NumberTransformType } from "@/components/dialog/NumberTransformDialog";

interface TableNodeData {
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  onContextMenu: (col: number, x: number, y: number) => void;
  onRename: (col: number, newName: string) => void;
  onSave: () => void;
  onDelete?: () => void;
}

function TableNode({ data, selected }: { data: TableNodeData; selected: boolean }) {
  const { headers, rows, columnWidths, onContextMenu, onRename, onSave, onDelete } = data;
  const [editingCol, setEditingCol] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showSaveButton, setShowSaveButton] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  const handleTableMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const handleTableMouseMove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleTableMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleStartEdit = (col: number, currentValue: string) => {
    setEditingCol(col);
    setEditValue(currentValue);
    setShowSaveButton(true);
    if (scrollContainerRef.current) {
      const colWidth = columnWidths[col] || 100;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScroll = col * colWidth - containerWidth / 2 + colWidth / 2;
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  };

  const handleHeaderSelect = (colIndex: number) => {
    setEditingCol(colIndex);
    setEditValue(headers[colIndex]);
    setShowSaveButton(true);
    if (scrollContainerRef.current) {
      const colWidth = columnWidths[colIndex] || 100;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScroll = colIndex * colWidth - containerWidth / 2 + colWidth / 2;
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  };

  const handleFinishEdit = () => {
    if (editingCol !== null && editValue.trim() && editValue !== headers[editingCol]) {
      onRename(editingCol, editValue.trim());
    }
    setEditingCol(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishEdit();
    } else if (e.key === "Escape") {
      setEditingCol(null);
      setEditValue("");
    }
  };

  return (
    <Card
      className={`w-[500px] overflow-hidden transition-all duration-200 ${selected
        ? "border-primary/50 shadow-lg ring-2 ring-primary/20"
        : "border-border/60 hover:border-primary/30"
        }`}
    >
      {/* TableNode 的双向 Handle */}
      <Handle type="source" position={Position.Right} id="table-right-source" className="opacity-0" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Left} id="table-left-target" className="opacity-0" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Left} id="table-left-source" className="opacity-0" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Right} id="table-right-target" className="opacity-0" style={{ opacity: 0, pointerEvents: 'none' }} />
      <div className="table-node-header px-3 py-2 bg-muted/50 border-b border-border/50 flex items-center gap-2">
        <div className="w-6 h-6 bg-gradient-to-br from-green-500/25 to-green-500/10 rounded flex items-center justify-center">
          <Table className="h-3 w-3 text-green-600" />
        </div>
        <span className="font-semibold text-sm">Input Data</span>
        <div className="flex-1">
          <SearchableSelect
            value=""
            onChange={(value) => {
              const colIndex = headers.indexOf(value);
              if (colIndex !== -1) {
                handleHeaderSelect(colIndex);
              }
            }}
            options={headers.map((h, _i) => ({ label: h, value: h }))}
            placeholder="Search header to edit..."
            size="sm"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          5 rows x {headers.length} cols
        </span>
        {showSaveButton && (
          <button
            onClick={() => {
              onSave();
              setShowSaveButton(false);
            }}
            className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-primary/10"
          >
            <Check className="h-3 w-3 text-green-500" />
          </button>
        )}
        <button
          onClick={() => onDelete?.()}
          className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-primary/10 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <ScrollArea
        className="h-[180px]"
        onWheel={handleWheel}
        onMouseDown={handleTableMouseDown}
        onMouseMove={handleTableMouseMove}
        onMouseUp={handleTableMouseUp}
      >
        <div className="min-w-max" ref={scrollContainerRef}>
          <table className="border-collapse">
            <colgroup>
              {headers.map((_, colIndex) => (
                <col key={colIndex} style={{ width: columnWidths[colIndex] || 100 }} />
              ))}
            </colgroup>
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                {headers.map((header, colIndex) => (
                  <th
                    key={colIndex}
                    className="border border-border/30 px-2 py-1.5 text-xs font-semibold text-left truncate min-w-[100px]"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenu(colIndex, e.clientX, e.clientY);
                    }}
                    onDoubleClick={() => handleStartEdit(colIndex, header)}
                  >
                    {editingCol === colIndex ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleFinishEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-background px-1 py-0.5 text-xs border border-primary rounded"
                        autoFocus
                      />
                    ) : (
                      header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/20">
                  {headers.map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-border/30 px-2 py-1 text-xs truncate min-w-[100px]"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onContextMenu(colIndex, e.clientX, e.clientY);
                      }}
                    >
                      {row[colIndex] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </Card>
  );
}

interface PipelineStepNodeData {
  step: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  onStepRemove: (stepId: string | string[]) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onContextMenu: (stepId: string, x: number, y: number) => void;
  isSelected: boolean;
  index: number;
  isCutting?: boolean;
  isPendingDelete?: boolean;
  cutParts?: CutPartInfo[];
  isHighlighted?: boolean;
}

function PipelineStepNode({
  data,
  selected,
}: {
  data: PipelineStepNodeData;
  selected: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.step.alias || "");

  const activeParams = useMemo(() => {
    return Object.entries(data.step.parameters)
      .filter(([, value]) => {
        // 对于布尔值(flag参数),只有值为true时才显示
        if (typeof value === "boolean") {
          return value === true;
        }
        // 对于其他参数,过滤掉 undefined 和空字符串
        return value !== undefined && value !== "";
      })
      .map(([key, value]) => {
        // 对于布尔值(flag参数),只显示参数名
        if (typeof value === "boolean") {
          return [key, null]; // null 表示不显示值
        }
        return [key, value];
      });
  }, [data.step.parameters]);

  // 分离flag参数和非flag参数
  const flagParams = useMemo(() => {
    return activeParams.filter(([, value]) => value === null);
  }, [activeParams]);

  const nonFlagParams = useMemo(() => {
    return activeParams.filter(([, value]) => value !== null);
  }, [activeParams]);

  const handleAliasSave = () => {
    data.onStepAliasUpdate(data.step.id, editValue.trim());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAliasSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(data.step.alias || "");
    }
  };

  // 渲染节点内容的辅助函数
  const renderCardContent = () => (
    <>
      {/* 双向 Handle - 左侧既是 target 也是 source */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
      <div className="p-3">
        <div className="flex items-center gap-2 w-full">
          {isEditing ? (
            <div className="flex items-center gap-1 w-full">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-[90%] h-6 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
                placeholder="Alias"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAliasSave();
                }}
                className="w-[5%] h-6 bg-green-500/10 hover:bg-green-500/20 rounded flex items-center justify-center transition-colors min-w-[24px]"
              >
                <Check className="h-3 w-3 text-green-600" />
              </button>
            </div>
          ) : (
            <>
              <div className="font-semibold text-xs truncate flex-1 min-w-0">
                {data.step.alias || data.step.command.name}
              </div>
              {data.step.alias && (
                <span className="text-[9px] text-muted-foreground/70 bg-muted/60 px-1 py-0.5 rounded border border-border/40 ml-auto">
                  {data.step.command.name}
                </span>
              )}
            </>
          )}
        </div>
        {(nonFlagParams.length > 0 || flagParams.length > 0) && (
          <div className="mt-1 space-y-0.5">
            {nonFlagParams.length > 0 && (
              <div className="text-[9px] text-muted-foreground flex flex-wrap gap-0.5">
                {nonFlagParams.map(([key, value]) => (
                  <span
                    key={key}
                    className="bg-muted/70 px-1 py-0.5 rounded border border-border/40 max-w-full overflow-hidden"
                    style={{ wordBreak: 'break-word' }}
                  >
                    <span className="text-muted-foreground/80">{key}=</span>
                    <span className="font-medium">{String(value)}</span>
                  </span>
                ))}
              </div>
            )}
            {flagParams.length > 0 && (
              <div className="text-[9px] text-muted-foreground flex flex-wrap gap-0.5">
                {flagParams.map(([key]) => (
                  <span
                    key={key}
                    className="bg-muted/70 px-1 py-0.5 rounded border border-border/40"
                  >
                    <span className="font-medium">{key}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="absolute -top-2 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onStepClick(data.step);
          }}
          className="w-5 h-5 bg-background border shadow-sm rounded flex items-center justify-center hover:bg-accent transition-colors"
        >
          <Settings className="h-2.5 w-2.5" />
        </button>
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="w-5 h-5 bg-background border shadow-sm rounded flex items-center justify-center hover:bg-accent transition-colors"
          >
            <Edit3 className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
      {/* 双向 Handle - 右侧既是 source 也是 target */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
    </>
  );

  const cardClass = `w-[220px] transition-all duration-200 hover:shadow-lg group relative ${selected
    ? "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/50 shadow-md ring-2 ring-primary/20"
    : "bg-card/95 hover:bg-accent/30 border-border/60 hover:border-primary/30"
    } ${data.isPendingDelete ? "border-orange-500" : ""} ${data.isHighlighted ? "ring-2 ring-primary ring-offset-2 animate-pulse-once" : ""}`;

  // 如果有切割部分,渲染两个切割碎片
  if (data.cutParts && data.cutParts.length > 0) {
    return (
      <div className="relative w-[220px]" style={{ height: 'auto' }}>
        {data.cutParts.map((part, idx) => (
          <div
            key={idx}
            className="cut-part-fall"
            style={{
              clipPath: part.clipPath,
              '--fall-dx': `${part.fallDx}px`,
              '--fall-dy': `${part.fallDy}px`,
              '--fall-rotation': `${part.fallRotation}deg`,
            } as React.CSSProperties}
          >
            <Card
              className={cardClass}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                data.onContextMenu(data.step.id, e.clientX, e.clientY);
              }}
            >
              {renderCardContent()}
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative ${data.isCutting ? "cutting-animation" : ""}`}>
      <Card
        className={`${cardClass} ${data.isCutting ? "cut-node" : ""}`}
        style={{
          boxShadow: data.isPendingDelete ? '0 0 12px rgba(249, 115, 22, 0.6)' : undefined,
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          data.onContextMenu(data.step.id, e.clientX, e.clientY);
        }}
      >
        {renderCardContent()}
      </Card>
    </div>
  );
}

const nodeTypes = {
  tableNode: TableNode,
  pipelineStep: PipelineStepNode,
};

// 切割部分信息
interface CutPartInfo {
  nodeId: string;
  partIndex: 0 | 1;
  clipPath: string;
  fallDx: number;
  fallDy: number;
  fallRotation: number;
}

// 计算线段与矩形的两个交点
function getCutIntersectionPoints(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
  const { x: rx, y: ry, width: rw, height: rh } = rect;
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) return null;

  const intersections: { x: number; y: number }[] = [];

  // 检查与四条边的交点
  const edges = [
    { x1: rx, y1: ry, x2: rx + rw, y2: ry },           // 上边
    { x1: rx + rw, y1: ry, x2: rx + rw, y2: ry + rh }, // 右边
    { x1: rx, y1: ry + rh, x2: rx + rw, y2: ry + rh }, // 下边
    { x1: rx, y1: ry, x2: rx, y2: ry + rh },            // 左边
  ];

  for (const edge of edges) {
    const ex = edge.x2 - edge.x1;
    const ey = edge.y2 - edge.y1;

    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) continue;

    const t = ((edge.x1 - lineStart.x) * ey - (edge.y1 - lineStart.y) * ex) / denom;
    const u = ((edge.x1 - lineStart.x) * dy - (edge.y1 - lineStart.y) * dx) / denom;

    if (t >= -0.001 && t <= 1.001 && u >= -0.001 && u <= 1.001) {
      const px = lineStart.x + t * dx;
      const py = lineStart.y + t * dy;
      // 限制在矩形边界内
      const cx = Math.max(rx, Math.min(rx + rw, px));
      const cy = Math.max(ry, Math.min(ry + rh, py));
      intersections.push({ x: cx, y: cy });
    }
  }

  // 去重（距离小于2的点视为同一个）
  const unique: { x: number; y: number }[] = [];
  for (const p of intersections) {
    if (!unique.some(u => Math.abs(u.x - p.x) < 2 && Math.abs(u.y - p.y) < 2)) {
      unique.push(p);
    }
  }

  if (unique.length >= 2) {
    return { p1: unique[0], p2: unique[1] };
  }

  // 如果只有一个交点（切割线从角开始）,添加角点作为第二个交点
  if (unique.length === 1) {
    const p = unique[0];
    // 找到最近的角
    const corners = [
      { x: rx, y: ry },
      { x: rx + rw, y: ry },
      { x: rx + rw, y: ry + rh },
      { x: rx, y: ry + rh },
    ];
    let nearestCorner = corners[0];
    let minDist = Infinity;
    for (const c of corners) {
      const dist = Math.sqrt((p.x - c.x) ** 2 + (p.y - c.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearestCorner = c;
      }
    }
    return { p1: p, p2: nearestCorner };
  }

  return null;
}

// 根据切割线和交点生成两部分的 clip-path 多边形
function generateCutClipPaths(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): { partA: string; partB: string } {
  const { x: rx, y: ry, width: rw, height: rh } = rect;

  // 矩形的四个角
  const corners = [
    { x: rx, y: ry },           // 左上 (TL)
    { x: rx + rw, y: ry },      // 右上 (TR)
    { x: rx + rw, y: ry + rh }, // 右下 (BR)
    { x: rx, y: ry + rh },      // 左下 (BL)
  ];

  // 计算每个角在切割线的哪一侧（使用叉积）
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const lineDx = p2.x - p1.x;
  const lineDy = p2.y - p1.y;

  const sideA: { x: number; y: number }[] = []; // 切割线左侧
  const sideB: { x: number; y: number }[] = []; // 切割线右侧

  for (const corner of corners) {
    const dx = corner.x - p1.x;
    const dy = corner.y - p1.y;
    const c = cross(lineDx, lineDy, dx, dy);

    if (c >= 0) {
      sideA.push(corner);
    } else {
      sideB.push(corner);
    }
  }

  // 构建多边形：角点 + 交点
  const buildPolygon = (side: { x: number; y: number }[]): string => {
    if (side.length === 0) return '';

    // 按角度排序角点（相对于 p1）
    const sorted = [...side].sort((a, b) => {
      const angleA = Math.atan2(a.y - p1.y, a.x - p1.x);
      const angleB = Math.atan2(b.y - p1.y, b.x - p1.x);
      return angleA - angleB;
    });

    // 构建多边形：交点p1 -> 排序的角点 -> 交点p2 -> 回到p1
    const points = [p1, ...sorted, p2];
    return `polygon(${points.map(p => `${p.x}px ${p.y}px`).join(', ')})`;
  };

  const partA = buildPolygon(sideA);
  const partB = buildPolygon(sideB);

  return { partA, partB };
}

// 计算坠落方向（重力 + 切割方向混合）
function calculateFallVector(
  cutPath: { x: number; y: number }[]
): { dx: number; dy: number; rotation: number } {
  if (cutPath.length < 2) {
    return { dx: 0, dy: 200, rotation: 15 };
  }

  // 切割方向：从末尾两点计算
  const last = cutPath[cutPath.length - 1];
  const prev = cutPath[cutPath.length - 2];
  let cutDx = last.x - prev.x;
  let cutDy = last.y - prev.y;
  const cutLen = Math.sqrt(cutDx * cutDx + cutDy * cutDy);

  if (cutLen > 0) {
    cutDx /= cutLen;
    cutDy /= cutLen;
  }

  // 混合：70% 重力方向（向下） + 30% 切割方向
  const gravityWeight = 0.7;
  const cutWeight = 0.3;
  const fdx = cutDx * cutWeight * 120;
  const fdy = (1 * gravityWeight + cutDy * cutWeight) * 200;

  // 旋转角度：根据方向计算
  const angle = Math.atan2(cutDx, 1) * (180 / Math.PI);
  const rotation = Math.max(-30, Math.min(30, angle * 0.5));

  return { dx: fdx, dy: fdy, rotation };
}

interface FlowPanelProps {
  steps: PipelineStep[];
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onStepRemove: (stepId: string | string[]) => void;
  onOpenFilterDialog: (col: number, x: number, y: number) => void;
  onOpenPivotDialog: (x: number, y: number) => void;
  onOpenDateTransformDialog: (col: number, x: number, y: number) => void;
  onOpenSliceDialog: (col: number, x: number, y: number, sliceType?: string) => void;
  onOpenReplaceDialog: (col: number, x: number, y: number) => void;
  onOpenWindowDialog: (col: number, x: number, y: number) => void;
  onOpenPadDialog: (col: number, x: number, y: number, padType: string) => void;
  onOpenSortDialog: (col: number, x: number, y: number) => void;
  onOpenTextTransformDialog: (col: number, x: number, y: number, transformType?: TextTransformType) => void;
  onOpenNumberTransformDialog: (col: number, x: number, y: number, transformType?: NumberTransformType) => void;
  onTableRename: (col: number, newName: string) => void;
  onSave: () => void;
  onTableDelete?: () => void;
  selectedStepId?: string;
  onEdgesChange?: (edges: PipelineEdge[]) => void;
  onInputPositionChange?: (position: { x: number; y: number }) => void;
  savedEdges?: PipelineEdge[];
  savedInputPosition?: { x: number; y: number };
}

function getLayoutedElements(
  hasTable: boolean,
  steps: PipelineStep[],
  headers: string[],
  rows: string[][],
  columnWidths: Record<number, number>,
  onStepClick: (step: PipelineStep) => void,
  onStepRemove: (stepId: string | string[]) => void,
  onStepAliasUpdate: (stepId: string, alias: string) => void,
  onContextMenu: (stepId: string, x: number, y: number) => void,
  onTableContextMenu: (col: number, x: number, y: number) => void,
  onTableRename: (col: number, newName: string) => void,
  onSave: () => void,
  selectedStepId?: string,
  savedEdges?: PipelineEdge[],
  savedInputPosition?: { x: number; y: number },
  highlightedNodeId?: string | null,
  onTableDelete?: () => void
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", nodesep: 25, ranksep: 50 });

  const nodes: Node[] = [];

  if (hasTable) {
    dagreGraph.setNode("table-node", { width: 520, height: 260 });
    nodes.push({
      id: "table-node",
      type: "tableNode",
      position: savedInputPosition || { x: 0, y: 0 },
      data: {
        headers,
        rows,
        columnWidths,
        onContextMenu: onTableContextMenu,
        onRename: onTableRename,
        onSave,
        onDelete: onTableDelete,
      },
      selected: false,
      dragHandle: ".table-node-header",
    });
  }

  steps.forEach((step) => {
    dagreGraph.setNode(step.id, { width: 240, height: 90 });
    nodes.push({
      id: step.id,
      type: "pipelineStep",
      position: step.position || { x: 0, y: 0 },
      data: {
        step,
        onStepClick,
        onStepRemove,
        onStepAliasUpdate,
        onContextMenu,
        isSelected: selectedStepId === step.id,
        isHighlighted: highlightedNodeId === step.id,
      },
      selected: selectedStepId === step.id,
    });
  });

  const edges: Edge[] = [];

  // 辅助函数: 创建连线
  const createEdge = (sourceId: string, targetId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);

    let sourceHandle: string;
    let targetHandle: string;

    if (sourceNode && targetNode) {
      const sourceX = sourceNode.position.x;
      const targetX = targetNode.position.x;

      if (sourceX <= targetX) {
        // 源在左,目标在右
        if (sourceId === 'table-node') {
          sourceHandle = 'table-right-source';
        } else {
          sourceHandle = 'right-source';
        }

        if (targetId === 'table-node') {
          targetHandle = 'table-left-target';
        } else {
          targetHandle = 'left-target';
        }
      } else {
        // 源在右,目标在左
        if (sourceId === 'table-node') {
          sourceHandle = 'table-left-source';
        } else {
          sourceHandle = 'left-source';
        }

        if (targetId === 'table-node') {
          targetHandle = 'table-right-target';
        } else {
          targetHandle = 'right-target';
        }
      }
    } else {
      // 默认值
      sourceHandle = sourceId === 'table-node' ? 'table-right-source' : 'right-source';
      targetHandle = targetId === 'table-node' ? 'table-left-target' : 'left-target';
    }

    const edgeConfig: any = {
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
      type: "default",
      data: { curvature: 0.5 },
      animated: sourceId === "table-node",
      style: { stroke: "var(--flow-line-color)", strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--flow-line-color)",
      },
    };

    return edgeConfig as Edge;
  };

  if (savedEdges && savedEdges.length > 0) {
    savedEdges.forEach((edge) => {
      edges.push(createEdge(edge.source, edge.target));
      if (edge.source !== "table-node" && edge.target !== "table-node") {
        dagreGraph.setEdge(edge.source, edge.target);
      }
    });
  } else if (hasTable && steps.length > 0) {
    edges.push(createEdge("table-node", steps[0].id));
    dagreGraph.setEdge("table-node", steps[0].id);
  }

  dagre.layout(dagreGraph);

  const MAX_STEPS_PER_COLUMN = 5;
  const COLUMN_WIDTH = 220;
  const ROW_HEIGHT = 75;

  const occupiedPositions = new Set<string>();

  nodes.forEach((n) => {
    if (n.id !== "table-node") {
      const pos = `${Math.round(n.position.x / COLUMN_WIDTH)}-${Math.round(n.position.y / ROW_HEIGHT)}`;
      occupiedPositions.add(pos);
    }
  });

  const findFirstAvailablePosition = (): { x: number; y: number } => {
    for (let col = 0; col < Math.ceil(steps.length / MAX_STEPS_PER_COLUMN) + 2; col++) {
      for (let row = 0; row < MAX_STEPS_PER_COLUMN; row++) {
        const posKey = `${col}-${row}`;
        if (!occupiedPositions.has(posKey)) {
          occupiedPositions.add(posKey);
          return { x: col * COLUMN_WIDTH, y: row * ROW_HEIGHT };
        }
      }
    }

    const totalNodes = nodes.filter(n => n.id !== "table-node").length;
    const column = Math.floor(totalNodes / MAX_STEPS_PER_COLUMN);
    const rowInColumn = totalNodes % MAX_STEPS_PER_COLUMN;
    const newPos = { x: column * COLUMN_WIDTH, y: rowInColumn * ROW_HEIGHT };
    occupiedPositions.add(`${column}-${rowInColumn}`);
    return newPos;
  };

  nodes.forEach((node) => {
    const step = steps.find((s) => s.id === node.id);
    if (step?.position) {
      node.position = step.position;
    } else if (node.id === "table-node" && savedInputPosition) {
      node.position = savedInputPosition;
    } else {
      const stepIndex = steps.findIndex((s) => s.id === node.id);
      if (stepIndex === -1) {
        const nodeWithPosition = dagreGraph.node(node.id);
        if (nodeWithPosition) {
          const width = nodeWithPosition.width || 200;
          const height = nodeWithPosition.height || 100;
          node.position = {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
          };
        }
      } else if (!step?.position) {
        const availablePos = findFirstAvailablePosition();
        node.position = availablePos;
      }
    }
  });

  return { nodes, edges };
}

export function FlowPanel({
  steps,
  headers,
  rows,
  columnWidths,
  onStepsChange,
  onStepClick,
  onStepAliasUpdate,
  onStepRemove,
  onOpenFilterDialog,
  onOpenPivotDialog,
  onOpenDateTransformDialog,
  onOpenSliceDialog,
  onOpenReplaceDialog,
  onOpenWindowDialog,
  onOpenPadDialog,
  onOpenSortDialog,
  onOpenTextTransformDialog,
  onOpenNumberTransformDialog,
  onTableRename,
  onSave,
  onTableDelete,
  selectedStepId,
  onEdgesChange,
  onInputPositionChange,
  savedEdges,
  savedInputPosition,
}: FlowPanelProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // 切水果功能状态
  const [cutPath, setCutPath] = useState<{ x: number; y: number }[]>([]);
  const [isCutting, setIsCutting] = useState(false);
  const [isClosingCut, setIsClosingCut] = useState(false);
  const [cutStartPoint, setCutStartPoint] = useState<{ x: number; y: number } | null>(null);
  // 被切元素的动画状态
  const [cutNodes, setCutNodes] = useState<Set<string>>(new Set());
  const [cutEdges, setCutEdges] = useState<Set<string>>(new Set());
  // 切割部分信息（用于自由坠落动画）
  const [cutParts, setCutParts] = useState<CutPartInfo[]>([]);
  // 实时高亮状态 - 用于显示即将被删除的元素
  const [pendingDeleteNodes, setPendingDeleteNodes] = useState<Set<string>>(new Set());
  const [pendingDeleteEdges, setPendingDeleteEdges] = useState<Set<string>>(new Set());

  // 画布搜索状态
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 右键连接功能状态
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectSourceNode, setConnectSourceNode] = useState<string | null>(null);
  const [connectPath, setConnectPath] = useState<{ x: number; y: number }[]>([]);
  const [connectTargetNode, setConnectTargetNode] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    stepId: string;
  } | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((stepId: string, x: number, y: number) => {
    setContextMenu({ x, y, stepId });
  }, []);

  const [tableContextMenu, setTableContextMenu] = useState<{
    x: number;
    y: number;
    col: number;
  } | null>(null);

  const closeTableContextMenu = useCallback(() => {
    setTableContextMenu(null);
  }, []);

  const handleTableContextMenu = useCallback((col: number, x: number, y: number) => {
    setTableContextMenu({ x, y, col });
  }, []);

  const handleTableRename = useCallback((col: number, newName: string) => {
    onTableRename(col, newName);
  }, [onTableRename]);

  // Ctrl+F 全局快捷键（HelpDialog 打开时由 HelpDialog 处理）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果对话框打开，不拦截 Ctrl+F
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 搜索框打开时自动聚焦
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isSearchOpen]);

  const hasTable = headers.length > 0 && rows.length > 0;

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      getLayoutedElements(
        hasTable,
        steps,
        headers,
        rows,
        columnWidths,
        onStepClick,
        onStepRemove,
        onStepAliasUpdate,
        handleContextMenu,
        handleTableContextMenu,
        handleTableRename,
        onSave,
        selectedStepId,
        savedEdges,
        savedInputPosition,
        highlightedNodeId,
        onTableDelete
      ),
    [hasTable, steps, headers, rows, columnWidths, selectedStepId, handleContextMenu, handleTableContextMenu, handleTableRename, onSave, savedEdges, savedInputPosition, highlightedNodeId, onTableDelete]
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // 搜索结果：匹配命令名称或 alias
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: { step: PipelineStep | null; displayName: string; secondaryName: string | null; isTableNode?: boolean }[] = [];

    // 搜索 "Input Data" 节点（不搜索其列名）
    if ("input data".includes(query) || "input".includes(query)) {
      results.push({ step: null, displayName: "Input Data", secondaryName: null, isTableNode: true });
    }

    // 搜索 pipeline 步骤
    for (const step of steps) {
      const name = step.command.name.toLowerCase();
      const alias = step.alias?.toLowerCase() || "";
      if (name.includes(query) || alias.includes(query)) {
        results.push({
          step,
          displayName: step.alias || step.command.name,
          secondaryName: step.alias ? step.command.name : null,
        });
      }
    }

    return results;
  }, [searchQuery, steps]);

  // 点击搜索结果：跳转到节点并高亮
  const handleSearchResultClick = useCallback((step: PipelineStep | null, isTable?: boolean) => {
    const nodeId = isTable ? "table-node" : step!.id;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !reactFlowInstance.current) return;

    // 使用 setCenter 跳转到节点位置（居中显示）
    const w = node.type === "tableNode" ? 260 : 110;
    const h = node.type === "tableNode" ? 130 : 45;
    reactFlowInstance.current.setCenter(
      node.position.x + w,
      node.position.y + h,
      {
        zoom: Math.max(reactFlowInstance.current.getZoom(), 0.8),
        duration: 400,
      }
    );

    // 设置高亮节点（触发动画）
    setHighlightedNodeId(nodeId);
    setTimeout(() => setHighlightedNodeId(null), 1500);

    // 关闭搜索框
    setIsSearchOpen(false);
    setSearchQuery("");
  }, [nodes]);

  // 当savedEdges变化时(如从history导入),更新本地edges状态
  useEffect(() => {
    if (savedEdges && savedEdges.length > 0) {
      const newEdges: Edge[] = savedEdges.map((edge) => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        let sourceHandle: string;
        let targetHandle: string;

        if (sourceNode && targetNode) {
          const sourceX = sourceNode.position.x;
          const targetX = targetNode.position.x;

          if (sourceX <= targetX) {
            // 源在左,目标在右
            if (edge.source === 'table-node') {
              sourceHandle = 'table-right-source';
            } else {
              sourceHandle = 'right-source';
            }

            if (edge.target === 'table-node') {
              targetHandle = 'table-left-target';
            } else {
              targetHandle = 'left-target';
            }
          } else {
            // 源在右,目标在左
            if (edge.source === 'table-node') {
              sourceHandle = 'table-left-source';
            } else {
              sourceHandle = 'left-source';
            }

            if (edge.target === 'table-node') {
              targetHandle = 'table-right-target';
            } else {
              targetHandle = 'right-target';
            }
          }
        } else {
          // 默认值
          sourceHandle = edge.source === 'table-node' ? 'table-right-source' : 'right-source';
          targetHandle = edge.target === 'table-node' ? 'table-left-target' : 'left-target';
        }

        const edgeConfig: any = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle,
          targetHandle,
          type: "default",
          data: { curvature: 0.5 },
          animated: edge.source === "table-node",
          style: { stroke: "var(--flow-line-color)", strokeWidth: 1.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "var(--flow-line-color)",
          },
        };

        return edgeConfig as Edge;
      });
      setEdges(newEdges);
    }
  }, [savedEdges, nodes]);

  // 线段与矩形相交检测
  const lineIntersectsRect = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    rect: DOMRect
  ): boolean => {
    const rectLines = [
      { x1: rect.left, y1: rect.top, x2: rect.right, y2: rect.top },
      { x1: rect.right, y1: rect.top, x2: rect.right, y2: rect.bottom },
      { x1: rect.right, y1: rect.bottom, x2: rect.left, y2: rect.bottom },
      { x1: rect.left, y1: rect.bottom, x2: rect.left, y2: rect.top },
    ];

    for (const rectLine of rectLines) {
      if (linesIntersect(
        p1.x, p1.y, p2.x, p2.y,
        rectLine.x1, rectLine.y1, rectLine.x2, rectLine.y2
      )) {
        return true;
      }
    }

    return (
      (p1.x >= rect.left && p1.x <= rect.right && p1.y >= rect.top && p1.y <= rect.bottom) ||
      (p2.x >= rect.left && p2.x <= rect.right && p2.y >= rect.top && p2.y <= rect.bottom)
    );
  };

  // 两条线段相交检测
  const linesIntersect = (
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): boolean => {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  };

  // ReactFlow 实例引用
  const reactFlowInstance = useRef<any>(null);

  // 碰撞检测函数
  const detectAndDeleteElements = useCallback((path: { x: number; y: number }[]) => {
    if (path.length < 2 || !reactFlowWrapper.current) return;

    // 将切水果路径转换为 ReactFlow 画布坐标
    // path 是容器相对坐标,需要转换为屏幕坐标后再调用 screenToFlowPosition
    const rect = reactFlowWrapper.current.getBoundingClientRect();
    const flowPath = path.map(p => {
      return reactFlowInstance.current?.screenToFlowPosition({
        x: p.x + rect.left,
        y: p.y + rect.top
      }) || { x: 0, y: 0 };
    });

    // 构建节点位置映射
    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    nodes.forEach(node => {
      const nodeData = node as any;
      nodePositions.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: nodeData.measured?.width || 200,
        height: nodeData.measured?.height || 80,
      });
    });

    // 检测连线碰撞
    const edgesToDelete: string[] = [];
    const edgeTargets = new Set<string>();

    edges.forEach(edge => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);

      if (!sourcePos || !targetPos) return;

      // 连线的起点和终点(使用节点的中点)
      const edgeStart = {
        x: sourcePos.x + sourcePos.width,
        y: sourcePos.y + sourcePos.height / 2,
      };
      const edgeEnd = {
        x: targetPos.x,
        y: targetPos.y + targetPos.height / 2,
      };

      // 检测切水果路径是否与连线相交
      for (let i = 0; i < flowPath.length - 1; i++) {
        const p1 = flowPath[i];
        const p2 = flowPath[i + 1];

        // 检测线段相交
        if (linesIntersect(
          p1.x, p1.y, p2.x, p2.y,
          edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y
        )) {
          edgesToDelete.push(edge.id);
          edgeTargets.add(edge.target);
          break;
        }

        // 也检测距离连线的最小距离是否小于阈值
        const dist1 = pointToLineDistance(p1, edgeStart, edgeEnd);
        const dist2 = pointToLineDistance(p2, edgeStart, edgeEnd);
        if (dist1 < 20 || dist2 < 20) {
          if (!edgesToDelete.includes(edge.id)) {
            edgesToDelete.push(edge.id);
            edgeTargets.add(edge.target);
          }
        }
      }
    });

    // 检测节点碰撞 - 简化算法,更容易切割
    const nodesToDelete: string[] = [];

    nodes.forEach(node => {
      if (node.id === 'table-node') return;
      if (edgeTargets.has(node.id)) return;

      const nodePos = nodePositions.get(node.id);
      if (!nodePos) return;

      const nodeRect = {
        left: nodePos.x,
        right: nodePos.x + nodePos.width,
        top: nodePos.y,
        bottom: nodePos.y + nodePos.height,
      };

      // 简单检测: 只要有任何线段穿过节点,就触发切割
      for (let i = 0; i < flowPath.length - 1; i++) {
        const p1 = flowPath[i];
        const p2 = flowPath[i + 1];

        if (lineIntersectsRect(p1, p2, nodeRect as DOMRect)) {
          nodesToDelete.push(node.id);
          break;
        }
      }
    });

    // 添加切水果动画效果
    if (edgesToDelete.length > 0 || nodesToDelete.length > 0) {
      // 设置被切元素的动画状态
      const newCutEdges = new Set(cutEdges);
      edgesToDelete.forEach(id => newCutEdges.add(id));
      setCutEdges(newCutEdges);

      const newCutNodes = new Set(cutNodes);
      nodesToDelete.forEach(id => newCutNodes.add(id));
      setCutNodes(newCutNodes);

      // 为被切节点计算切割部分（自由坠落动画）
      const fallVec = calculateFallVector(path);
      const newCutParts: CutPartInfo[] = [];

      nodesToDelete.forEach(nodeId => {
        const nodePos = nodePositions.get(nodeId);
        if (!nodePos) return;

        // 使用 flowPath（ReactFlow 坐标）来计算交点
        const localStart = { x: flowPath[0].x - nodePos.x, y: flowPath[0].y - nodePos.y };
        const localEnd = { x: flowPath[flowPath.length - 1].x - nodePos.x, y: flowPath[flowPath.length - 1].y - nodePos.y };

        const rect = { x: 0, y: 0, width: nodePos.width, height: nodePos.height };
        const intersection = getCutIntersectionPoints(localStart, localEnd, rect);

        if (intersection) {
          const { partA, partB } = generateCutClipPaths(intersection.p1, intersection.p2, rect);

          // Part A: 一侧,坠落方向与切割方向同向
          newCutParts.push({
            nodeId,
            partIndex: 0,
            clipPath: partA,
            fallDx: fallVec.dx,
            fallDy: fallVec.dy,
            fallRotation: fallVec.rotation,
          });
          // Part B: 另一侧,坠落方向相反
          newCutParts.push({
            nodeId,
            partIndex: 1,
            clipPath: partB,
            fallDx: -fallVec.dx * 0.6,
            fallDy: fallVec.dy * 1.2,
            fallRotation: -fallVec.rotation,
          });
        }
      });

      setCutParts(newCutParts);

      // 动画完成后删除元素
      setTimeout(() => {
        if (edgesToDelete.length > 0) {
          const updatedEdges = edges.filter(edge => !edgesToDelete.includes(edge.id));
          setEdges(updatedEdges);
          // 同步更新父组件
          if (onEdgesChange) {
            const pipelineEdges = updatedEdges
              .filter((e) => e.source && e.target)
              .map((e) => ({ id: e.id, source: e.source, target: e.target }));
            onEdgesChange(pipelineEdges);
          }
        }

        // 传递所有需要删除的节点ID给父组件
        if (nodesToDelete.length > 0) {
          onStepRemove(nodesToDelete);
        }

        // 清除动画状态
        setCutEdges(new Set());
        setCutNodes(new Set());
        setCutParts([]);
      }, 700); // 动画持续时间
    }
  }, [edges, nodes, setEdges, onStepRemove, onEdgesChange, cutEdges, cutNodes]);

  // 点到线段的距离
  const pointToLineDistance = (
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  };

  // 判断点击位置是否在节点上
  const getNodeAtPosition = useCallback((clientX: number, clientY: number): string | null => {
    if (!reactFlowWrapper.current || !reactFlowInstance.current) return null;

    // 将屏幕坐标转换为流程图坐标
    const flowPos = reactFlowInstance.current.screenToFlowPosition({ x: clientX, y: clientY });

    for (const node of nodes) {
      const nodeData = node as any;
      const width = nodeData.measured?.width || 200;
      const height = nodeData.measured?.height || 80;

      if (
        flowPos.x >= node.position.x &&
        flowPos.x <= node.position.x + width &&
        flowPos.y >= node.position.y &&
        flowPos.y <= node.position.y + height
      ) {
        return node.id;
      }
    }
    return null;
  }, [nodes]);

  // 右键按下 - 开始连接或切水果
  const handleCutStart = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();

      const clickedNode = getNodeAtPosition(e.clientX, e.clientY);

      if (clickedNode && clickedNode !== 'table-node') {
        // 右键点击节点 - 开始连接
        setIsConnecting(true);
        setConnectSourceNode(clickedNode);
        if (reactFlowWrapper.current) {
          const rect = reactFlowWrapper.current.getBoundingClientRect();
          setConnectPath([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
        }
      } else {
        // 右键点击空白区域 - 切水果模式
        setIsCutting(true);
        setIsClosingCut(false);
        if (reactFlowWrapper.current) {
          const rect = reactFlowWrapper.current.getBoundingClientRect();
          const startPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          setCutStartPoint(startPoint);
          setCutPath([startPoint]);
        }
      }
    }
  }, [getNodeAtPosition]);

  // 右键移动 - 连接模式或切水果模式
  const handleCutMove = useCallback((e: React.MouseEvent) => {
    if (isConnecting && reactFlowWrapper.current) {
      // 连接模式 - 跟踪鼠标轨迹
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      setConnectPath(prev => [...prev.slice(-20), { x: e.clientX - rect.left, y: e.clientY - rect.top }]);

      // 检测鼠标是否悬停在目标节点上(允许 table-node 作为目标)
      const hoveredNode = getNodeAtPosition(e.clientX, e.clientY);
      if (hoveredNode && hoveredNode !== connectSourceNode) {
        setConnectTargetNode(hoveredNode);
      } else {
        setConnectTargetNode(null);
      }
    } else if (isCutting && !isClosingCut && reactFlowWrapper.current) {
      // 切水果模式 - 显示为直线(起点到当前点)
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const newPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      // 显示用的路径只保留起点和当前点(直线)
      if (cutStartPoint) {
        setCutPath([cutStartPoint, newPoint]);
      }

      // 实时碰撞检测 - 更新待删除元素高亮
      if (cutPath.length >= 2 && reactFlowInstance.current) {
        // cutPath 是容器相对坐标,需要转换为屏幕坐标
        const flowPath = cutPath.map(p => reactFlowInstance.current!.screenToFlowPosition({
          x: p.x + rect.left,
          y: p.y + rect.top
        }));

        const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
        nodes.forEach(node => {
          const nodeData = node as any;
          nodePositions.set(node.id, {
            x: node.position.x,
            y: node.position.y,
            width: nodeData.measured?.width || 200,
            height: nodeData.measured?.height || 80,
          });
        });

        // 检测连线碰撞
        const pendingEdges = new Set<string>();
        const edgeTargets = new Set<string>();

        edges.forEach(edge => {
          const sourcePos = nodePositions.get(edge.source);
          const targetPos = nodePositions.get(edge.target);
          if (!sourcePos || !targetPos) return;

          const edgeStart = { x: sourcePos.x + sourcePos.width, y: sourcePos.y + sourcePos.height / 2 };
          const edgeEnd = { x: targetPos.x, y: targetPos.y + targetPos.height / 2 };

          for (let i = 0; i < flowPath.length - 1; i++) {
            const p1 = flowPath[i];
            const p2 = flowPath[i + 1];

            if (linesIntersect(p1.x, p1.y, p2.x, p2.y, edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y)) {
              pendingEdges.add(edge.id);
              edgeTargets.add(edge.target);
              break;
            }

            const dist1 = pointToLineDistance(p1, edgeStart, edgeEnd);
            const dist2 = pointToLineDistance(p2, edgeStart, edgeEnd);
            if (dist1 < 20 || dist2 < 20) {
              pendingEdges.add(edge.id);
              edgeTargets.add(edge.target);
              break;
            }
          }
        });

        // 检测节点碰撞
        const pendingNodes = new Set<string>();
        nodes.forEach(node => {
          if (node.id === 'table-node' || edgeTargets.has(node.id)) return;

          const nodePos = nodePositions.get(node.id);
          if (!nodePos) return;

          const nodeRect = {
            left: nodePos.x,
            right: nodePos.x + nodePos.width,
            top: nodePos.y,
            bottom: nodePos.y + nodePos.height,
          };

          for (let i = 0; i < flowPath.length - 1; i++) {
            if (lineIntersectsRect(flowPath[i], flowPath[i + 1], nodeRect as DOMRect)) {
              pendingNodes.add(node.id);
              break;
            }
          }
        });

        setPendingDeleteEdges(pendingEdges);
        setPendingDeleteNodes(pendingNodes);
      }
    }
  }, [isCutting, isConnecting, getNodeAtPosition, connectSourceNode, cutPath, nodes, edges, pointToLineDistance, linesIntersect, lineIntersectsRect]);

  // 创建连线
  const createEdge = useCallback((sourceId: string, targetId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);

    let sourceHandle: string;
    let targetHandle: string;

    if (sourceNode && targetNode) {
      const sourceX = sourceNode.position.x;
      const targetX = targetNode.position.x;

      if (sourceX <= targetX) {
        // 源在左,目标在右
        if (sourceId === 'table-node') {
          sourceHandle = 'table-right-source';
        } else {
          sourceHandle = 'right-source';
        }

        if (targetId === 'table-node') {
          targetHandle = 'table-left-target';
        } else {
          targetHandle = 'left-target';
        }
      } else {
        // 源在右,目标在左
        if (sourceId === 'table-node') {
          sourceHandle = 'table-left-source';
        } else {
          sourceHandle = 'left-source';
        }

        if (targetId === 'table-node') {
          targetHandle = 'table-right-target';
        } else {
          targetHandle = 'right-target';
        }
      }
    } else {
      // 默认值
      sourceHandle = sourceId === 'table-node' ? 'table-right-source' : 'right-source';
      targetHandle = targetId === 'table-node' ? 'table-left-target' : 'left-target';
    }

    const edgeConfig: any = {
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
      type: 'default',
      animated: false,
      data: {
        curvature: 0.5,
      },
      style: {
        stroke: 'var(--flow-line-color)',
        strokeWidth: 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--flow-line-color)',
      },
    };

    const newEdge: Edge = edgeConfig;

    setEdges((eds) => {
      // 检查是否已存在相同的连线
      const existingEdge = eds.find(e => e.source === sourceId && e.target === targetId);
      if (existingEdge) return eds;

      const newEdges = [...eds, newEdge];

      if (onEdgesChange) {
        const pipelineEdges: PipelineEdge[] = newEdges
          .filter((e) => e.source && e.target)
          .map((e) => ({ id: e.id, source: e.source, target: e.target }));
        onEdgesChange(pipelineEdges);
      }

      return newEdges;
    });
  }, [setEdges, onEdgesChange, nodes]);

  // 右键松开 - 完成连接或切水果
  const handleCutEnd = useCallback((e: React.MouseEvent) => {
    if (isConnecting) {
      e.preventDefault();
      e.stopPropagation();

      if (connectSourceNode && connectTargetNode && connectPath.length > 1) {
        createEdge(connectSourceNode, connectTargetNode);
      }

      setIsConnecting(false);
      setConnectSourceNode(null);
      setConnectTargetNode(null);
      setConnectPath([]);
    } else if (isCutting) {
      e.preventDefault();
      e.stopPropagation();

      if (cutPath.length > 1) {
        const currentPath = [...cutPath];
        detectAndDeleteElements(currentPath);
      }

      // 启动收刀动画 - A点向B点快速移动
      setIsClosingCut(true);
      setIsCutting(false);

      // 动画完成后清除状态
      setTimeout(() => {
        setIsClosingCut(false);
        setCutPath([]);
        setCutStartPoint(null);
        // 清除实时高亮状态
        setPendingDeleteNodes(new Set());
        setPendingDeleteEdges(new Set());
      }, 150);
    }
  }, [isCutting, isConnecting, cutPath, detectAndDeleteElements, connectSourceNode, connectTargetNode, connectPath, createEdge]);

  // 屏蔽默认右键菜单
  const handlePanelContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const { nodes: layoutedNodes } = getLayoutedElements(
      hasTable,
      steps,
      headers,
      rows,
      columnWidths,
      onStepClick,
      onStepRemove,
      onStepAliasUpdate,
      handleContextMenu,
      handleTableContextMenu,
      handleTableRename,
      onSave,
      selectedStepId,
      savedEdges,
      savedInputPosition,
      undefined,
      onTableDelete
    );

    const updatedNodes = layoutedNodes.map((newNode) => {
      const existingNode = nodes.find((n) => n.id === newNode.id);
      if (existingNode && existingNode.position) {
        return { ...newNode, position: existingNode.position };
      }
      return newNode;
    });

    setNodes(updatedNodes);
  }, [hasTable, steps, headers, rows, columnWidths, selectedStepId, onStepClick, onStepRemove, onStepAliasUpdate, handleContextMenu, handleTableContextMenu, handleTableRename, onSave, setNodes, savedEdges, savedInputPosition, onTableDelete]);

  // 更新节点的 isCutting 属性、待删除高亮效果和切割部分
  useEffect(() => {
    setNodes(prevNodes => prevNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isCutting: cutNodes.has(node.id),
        isPendingDelete: pendingDeleteNodes.has(node.id),
        cutParts: cutParts.filter(p => p.nodeId === node.id),
      },
    })));
  }, [cutNodes, pendingDeleteNodes, cutParts]);

  // 更新连线的切断效果和待删除高亮效果
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setEdges(prevEdges => prevEdges.map(edge => {
        const isCut = cutEdges.has(edge.id);
        const isPending = pendingDeleteEdges.has(edge.id);
        return {
          ...edge,
          style: {
            ...edge.style,
            strokeDasharray: isCut ? '10' : undefined,
            animation: isCut ? 'cut-edge-animation 0.2s ease-out forwards' : undefined,
            stroke: isPending && !isCut ? '#f97316' : edge.style?.stroke,
            filter: isPending && !isCut ? 'drop-shadow(0 0 6px rgba(249, 115, 22, 0.7))' : undefined,
          },
        };
      }));
    });
    return () => cancelAnimationFrame(rafId);
  }, [cutEdges, pendingDeleteEdges]);

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
      closeTableContextMenu();
    };
    if (contextMenu || tableContextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu, tableContextMenu, closeContextMenu, closeTableContextMenu]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, nodes: Node[]) => {
      const positionMap = new Map<string, { x: number; y: number }>();
      nodes.forEach((node) => {
        positionMap.set(node.id, node.position);
      });

      const updatedSteps = steps.map((step) => {
        const newPos = positionMap.get(step.id);
        if (newPos) {
          return { ...step, position: newPos };
        }
        return step;
      });

      onStepsChange(updatedSteps);

      const inputPos = positionMap.get("table-node");
      if (inputPos && onInputPositionChange) {
        onInputPositionChange(inputPos);
      }
    },
    [steps, onStepsChange, onInputPositionChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updatedEdges = applyEdgeChanges(changes, eds);
        if (onEdgesChange) {
          const pipelineEdges: PipelineEdge[] = updatedEdges
            .filter((e) => e.source && e.target)
            .map((e) => ({ id: e.id, source: e.source, target: e.target }));
          onEdgesChange(pipelineEdges);
        }
        return updatedEdges;
      });
    },
    [setEdges, onEdgesChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);

      let sourceHandle: string;
      let targetHandle: string;

      if (sourceNode && targetNode) {
        const sourceX = sourceNode.position.x;
        const targetX = targetNode.position.x;

        if (sourceX <= targetX) {
          // 源在左,目标在右
          if (connection.source === 'table-node') {
            sourceHandle = 'table-right-source';
          } else {
            sourceHandle = 'right-source';
          }

          if (connection.target === 'table-node') {
            targetHandle = 'table-left-target';
          } else {
            targetHandle = 'left-target';
          }
        } else {
          // 源在右,目标在左
          if (connection.source === 'table-node') {
            sourceHandle = 'table-left-source';
          } else {
            sourceHandle = 'left-source';
          }

          if (connection.target === 'table-node') {
            targetHandle = 'table-right-target';
          } else {
            targetHandle = 'right-target';
          }
        }
      } else {
        // 默认值
        sourceHandle = connection.source === 'table-node' ? 'table-right-source' : 'right-source';
        targetHandle = connection.target === 'table-node' ? 'table-left-target' : 'left-target';
      }

      const edgeConfig: any = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        sourceHandle,
        targetHandle,
        type: "default",
        animated: false,
        style: { stroke: "var(--flow-line-color)", strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "var(--flow-line-color)",
        },
      };

      const newEdge: Edge = edgeConfig;

      setEdges((eds) => {
        const newEdges = [...eds, newEdge];
        const graph = new Map<string, string[]>();
        const stepIds = steps.map((s) => s.id);

        stepIds.forEach((id) => graph.set(id, []));
        newEdges.forEach((edge) => {
          if (stepIds.includes(edge.source) && stepIds.includes(edge.target)) {
            const targets = graph.get(edge.source) || [];
            targets.push(edge.target);
            graph.set(edge.source, targets);
          }
        });

        const visited = new Set<string>();
        const result: string[] = [];

        const visit = (nodeId: string) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);
          const neighbors = graph.get(nodeId) || [];
          neighbors.forEach((neighbor) => visit(neighbor));
          result.unshift(nodeId);
        };

        stepIds.forEach((id) => visit(id));

        const stepMap = new Map(steps.map((s) => [s.id, s]));
        const reorderedSteps = result
          .map((id) => stepMap.get(id))
          .filter((s): s is PipelineStep => s !== undefined);

        if (reorderedSteps.length === steps.length) {
          const orderChanged = reorderedSteps.some((s, i) => s.id !== steps[i].id);
          if (orderChanged) {
            onStepsChange(reorderedSteps);
          }
        }

        if (onEdgesChange) {
          const pipelineEdges: PipelineEdge[] = newEdges
            .filter((e) => e.source && e.target)
            .map((e) => ({ id: e.id, source: e.source, target: e.target }));
          onEdgesChange(pipelineEdges);
        }

        return newEdges;
      });
    },
    [steps, onStepsChange, setEdges, onEdgesChange, nodes]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full relative"
      onMouseDown={handleCutStart}
      onMouseMove={handleCutMove}
      onMouseUp={handleCutEnd}
      onContextMenu={handlePanelContextMenu}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "default",
          style: { stroke: "var(--flow-line-color)", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
        onInit={(instance) => { reactFlowInstance.current = instance; }}
      >
        <CoordinateGrid />
      </ReactFlow>

      {/* 画布搜索框 */}
      {isSearchOpen && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 w-80">
          <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {/* 搜索输入框 */}
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                  } else if (e.key === "Enter" && searchResults.length > 0) {
                    handleSearchResultClick(searchResults[0].step, searchResults[0].isTableNode);
                  }
                }}
                placeholder="Search in the workflow..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <span className="text-[10px] text-muted-foreground">
                ESC
              </span>
            </div>

            {/* 搜索结果下拉列表 - 仅在有搜索内容时显示 */}
            {searchQuery && searchResults.length > 0 && (
              <ScrollArea className="h-[16vh]">
                <div className="py-1">
                  {searchResults.map((result) => {
                    const CommandIcon = result.isTableNode
                      ? Table
                      : (commandIconMap[result.step!.command.name] || Terminal);
                    return (
                      <button
                        key={result.isTableNode ? "table-node" : result.step!.id}
                        onClick={() => handleSearchResultClick(result.step, result.isTableNode)}
                        className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CommandIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{result.displayName}</span>
                        </div>
                        {result.secondaryName && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                            {result.secondaryName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* 无结果提示 - 仅在有搜索内容但无匹配时显示 */}
            {searchQuery && searchResults.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No matching command found
              </div>
            )}
          </div>
        </div>
      )}

      {/* 切水果轨迹线 */}
      {(isCutting || isClosingCut) && cutPath.length > 1 && (
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

          {/* 计算方向用于菱形 */}
          {(() => {
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
              <>
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
              </>
            );
          })()}
        </svg>
      )}

      {tableContextMenu && (
        <ContextMenu
          contextMenu={{ x: tableContextMenu.x, y: tableContextMenu.y, row: null, col: tableContextMenu.col }}
          onClose={closeTableContextMenu}
          onOpenFilterDialog={onOpenFilterDialog}
          onOpenPivotDialog={onOpenPivotDialog}
          onOpenDateTransformDialog={onOpenDateTransformDialog}
          onOpenTextTransformDialog={onOpenTextTransformDialog}
          onOpenSliceDialog={onOpenSliceDialog}
          onOpenReplaceDialog={onOpenReplaceDialog}
          onOpenWindowDialog={onOpenWindowDialog}
          onOpenPadDialog={onOpenPadDialog}
          onOpenNumberTransformDialog={onOpenNumberTransformDialog}
          onOpenSortDialog={onOpenSortDialog}
        />
      )}

      {/* 连接线可视化 */}
      {isConnecting && connectPath.length > 0 && (
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
              松开右键连接
            </text>
          )}
        </svg>
      )}

    </div>
  );
}
