import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VariablePrompt } from "@/hooks/MainMenuHooks";
import { useLanguage } from "@/i18n";

interface VariableValuesDialogProps {
  prompt: VariablePrompt;
  onConfirm: (items: { name: string; value: string }[]) => void;
  onCancel: () => void;
}

/** One-shot collection dialog shown before execution when a pipeline
 *  references unassigned variables (F3). Values are runtime-only. */
export function VariableValuesDialog({
  prompt,
  onConfirm,
  onCancel,
}: VariableValuesDialogProps) {
  const { t } = useLanguage();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setOffset({
        x: dragStart.current.offsetX + (ev.clientX - dragStart.current.x),
        y: dragStart.current.offsetY + (ev.clientY - dragStart.current.y),
      });
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const v of prompt.variables) init[v.name] = v.value;
    return init;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onCancel}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-card border rounded-xl shadow-xl w-full max-w-md p-4 outline-none"
        onContextMenu={(e) => e.preventDefault()}
        style={{
          left: offset.x,
          top: offset.y,
        }}
      >
        <div
          className="flex items-center justify-between mb-2 select-none cursor-move"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-lg font-semibold">{t.runWithVariables}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label={t.close}
          >
            <X className="h-4 w-4 accent-foreground" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          {t.variableFillValues}
        </p>

        <div className="space-y-3">
          {prompt.variables.map((v) => (
            <div key={v.name}>
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="text-muted-foreground/60">{"{{"}</span>
                {v.name}
                <span className="text-muted-foreground/60">{"}}"}</span>
              </label>
              <input
                type="text"
                value={values[v.name] ?? ""}
                autoFocus
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                }
                placeholder={t.variableInputValue}
                className="w-full h-8 px-3 text-sm border rounded-md bg-background mt-1"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t.close}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onConfirm(
                prompt.variables.map((v) => ({
                  name: v.name,
                  value: values[v.name] ?? "",
                })),
              )
            }
          >
            {t.execute}
          </Button>
        </div>
      </div>
    </div>
  );
}
