import { useState } from "react";
import { Handle, Position } from "reactflow";
import { GitBranch, Edit3, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PipelineStep, ConditionalExpression } from "@/types/xan";

export interface ConditionalNodeData {
  step: PipelineStep;
  expression: ConditionalExpression;
  onExpressionUpdate: (stepId: string, expression: ConditionalExpression) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onContextMenu: (stepId: string, x: number, y: number) => void;
  isSelected: boolean;
  isCutting?: boolean;
  isPendingDelete?: boolean;
  isHighlighted?: boolean;
}

export function ConditionalNode({
  data,
  selected,
}: {
  data: ConditionalNodeData;
  selected: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAlias, setEditAlias] = useState(data.step.alias || "");
  const [editExpression, setEditExpression] = useState<ConditionalExpression>(
    data.expression,
  );

  const handleAliasSave = () => {
    data.onStepAliasUpdate(data.step.id, editAlias.trim());
    setIsEditing(false);
  };

  const handleExpressionSave = () => {
    data.onExpressionUpdate(data.step.id, editExpression);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isEditing) {
        handleExpressionSave();
      }
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditAlias(data.step.alias || "");
      setEditExpression(data.expression);
    }
  };

  const cardClass = `w-[240px] transition-all duration-200 hover:shadow-lg group relative ${
    selected
      ? "bg-gradient-to-r from-amber-500/15 to-amber-500/5 border-amber-500/50 shadow-md ring-2 ring-amber-500/20"
      : "bg-card/95 hover:bg-accent/30 border-border/60 hover:border-amber-500/30"
  } ${data.isPendingDelete ? "border-orange-500" : ""} ${
    data.isHighlighted ? "ring-2 ring-amber-500 ring-offset-2 animate-pulse-once" : ""
  }`;

  return (
    <Card className={cardClass}>
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-3 !h-3 !bg-amber-500/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!w-3 !h-3 !bg-amber-500/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      <div className="p-3">
        <div className="flex items-center gap-2 w-full">
          <GitBranch className="h-4 w-4 text-amber-500 flex-shrink-0" />
          {isEditing ? (
            <div className="flex items-center gap-1 w-full">
              <input
                type="text"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                className="w-[80%] h-6 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-amber-500/50"
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
                className="w-5 h-5 bg-green-500/10 hover:bg-green-500/20 rounded flex items-center justify-center transition-colors min-w-[20px]"
              >
                <Check className="h-3 w-3 text-green-600" />
              </button>
            </div>
          ) : (
            <>
              <div className="font-semibold text-xs truncate flex-1 min-w-0">
                {data.step.alias || "Condition"}
              </div>
              {data.step.alias && (
                <span className="text-[9px] text-muted-foreground/70 bg-muted/60 px-1 py-0.5 rounded border border-border/40 ml-auto">
                  condition
                </span>
              )}
            </>
          )}
        </div>

        <div className="mt-2 space-y-1">
          <div className="text-[10px] text-muted-foreground">
            <span className="font-medium">IF</span>{" "}
            <span className="text-amber-600">{editExpression.column}</span>{" "}
            <span className="font-medium">{editExpression.operator}</span>{" "}
            <span className="text-amber-600">"{editExpression.value}"</span>
          </div>
        </div>
      </div>

      <div className="absolute -top-2 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(!isEditing);
          }}
          className="w-5 h-5 bg-background border shadow-sm rounded flex items-center justify-center hover:bg-accent transition-colors"
        >
          <Edit3 className="h-2.5 w-2.5" />
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="right-source-true"
        className="!w-3 !h-3 !bg-green-500/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target-true"
        className="!w-3 !h-3 !bg-green-500/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source-false"
        className="!w-3 !h-3 !bg-red-500/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target-false"
        className="!w-3 !h-3 !bg-red-500/50 !border-2 !border-background opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </Card>
  );
}
