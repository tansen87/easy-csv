import React, { useMemo, useState } from "react";
import { Handle, Position } from "reactflow";
import { Settings, Edit3, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PipelineStep } from "@/types/xan";
import { CutPartInfo } from "@/components/panel/utils/cutGeometry";

export interface PipelineStepNodeData {
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

export function PipelineStepNode({
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
        if (typeof value === "boolean") {
          return value === true;
        }
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return value !== undefined && value !== "";
      })
      .map(([key, value]) => {
        if (typeof value === "boolean") {
          return [key, null];
        }
        if (Array.isArray(value)) {
          const count = value.length;
          if (count <= 2) {
            return [key, value.join(", ")];
          }
          const firstName = String(value[0]).split(/[\\/]/).pop() || value[0];
          return [key, `${firstName} +${count - 1} files`];
        }
        if (key === "source-path" && typeof value === "string") {
          const paths = value.split(";").filter((p: string) => p.trim());
          if (paths.length === 1) {
            const path = paths[0].trim();
            const lastSlash = Math.max(
              path.lastIndexOf("/"),
              path.lastIndexOf("\\"),
            );
            const lastDot = path.lastIndexOf(".");
            if (lastDot > lastSlash && lastSlash >= 0) {
              return [key, path.substring(0, lastSlash)];
            }
            return [key, path];
          }

          const folders = paths.map((p: string) => {
            const trimmed = p.trim();
            const lastSlash = Math.max(
              trimmed.lastIndexOf("/"),
              trimmed.lastIndexOf("\\"),
            );
            const lastDot = trimmed.lastIndexOf(".");
            if (lastDot > lastSlash && lastSlash >= 0) {
              return trimmed.substring(0, lastSlash);
            }
            return trimmed;
          });
          const uniqueFolders = [...new Set(folders)];
          return [key, uniqueFolders.join(";")];
        }
        return [key, value];
      });
  }, [data.step.parameters]);

  // Separate flag parameters and non flag parameters
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

  // Auxiliary functions for rendering node content
  const renderCardContent = () => (
    <>
      {/* 双向 Handle - 左侧既是 target 也是 source */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      {/* 双向 Handle - 顶部既是 source 也是 target */}
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
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
                    style={{ wordBreak: "break-word" }}
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
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      {/* 双向 Handle - 底部既是 source 也是 target */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </>
  );

  const cardClass = `w-[220px] transition-all duration-200 hover:shadow-lg group relative ${
    selected
      ? "bg-card/100 border-emerald-700/80 shadow-md ring-2 ring-emerald-700/30"
      : "bg-card/95 hover:bg-accent/30 border-border/60 hover:border-primary/30"
  } ${data.isPendingDelete ? "border-orange-500" : ""} ${data.isHighlighted ? "ring-2 ring-primary ring-offset-2 animate-pulse-once" : ""}`;

  // 如果有切割部分,渲染两个切割碎片
  if (data.cutParts && data.cutParts.length > 0) {
    return (
      <div className="relative w-[220px]" style={{ height: "auto" }}>
        {data.cutParts.map((part, idx) => (
          <div
            key={idx}
            className="cut-part-fall"
            style={
              {
                clipPath: part.clipPath,
                "--fall-dx": `${part.fallDx}px`,
                "--fall-dy": `${part.fallDy}px`,
                "--fall-rotation": `${part.fallRotation}deg`,
              } as React.CSSProperties
            }
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
          boxShadow: data.isPendingDelete
            ? "0 0 12px rgba(154, 154, 166, 0.6)"
            : undefined,
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
