import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ConditionalExpression } from "@/types/xan";

interface ConditionalStepDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expression: ConditionalExpression) => void;
  columns: string[];
  initialExpression?: ConditionalExpression;
}

const OPERATORS = [
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "==", label: "==" },
  { value: "!=", label: "!=" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "matches", label: "matches (regex)" },
];

export function ConditionalStepDialog({
  isOpen,
  onClose,
  onSave,
  columns,
  initialExpression,
}: ConditionalStepDialogProps) {
  const [expression, setExpression] = useState<ConditionalExpression>(
    initialExpression || {
      column: columns[0] || "",
      operator: ">",
      value: "",
    },
  );

  useEffect(() => {
    if (initialExpression) {
      setExpression(initialExpression);
    } else {
      setExpression({
        column: columns[0] || "",
        operator: ">",
        value: "",
      });
    }
  }, [initialExpression, columns]);

  const handleSave = () => {
    if (!expression.column || !expression.value) return;
    onSave(expression);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-[400px] p-4 bg-background shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Configure Condition</h2>
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Column
            </label>
            <select
              value={expression.column}
              onChange={(e) =>
                setExpression({ ...expression, column: e.target.value })
              }
              className="w-full h-8 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Operator
            </label>
            <select
              value={expression.operator}
              onChange={(e) =>
                setExpression({
                  ...expression,
                  operator: e.target.value as ConditionalExpression["operator"],
                })
              }
              className="w-full h-8 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Value
            </label>
            <input
              type="text"
              value={expression.value}
              onChange={(e) =>
                setExpression({ ...expression, value: e.target.value })
              }
              placeholder="Enter value..."
              className="w-full h-8 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            <span className="font-medium">Preview:</span>{" "}
            IF <span className="text-amber-600">{expression.column}</span>{" "}
            <span className="font-medium">{expression.operator}</span>{" "}
            <span className="text-amber-600">"{expression.value}"</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="h-8 px-4 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!expression.column || !expression.value}
            className="h-8 px-4 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </Card>
    </div>
  );
}
