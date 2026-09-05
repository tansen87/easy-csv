import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ConfirmDialog } from "@/components/dialog/ConfirmDialog";
import {
  PipelineStep,
  PipelineVariable,
  PipelineVariableType,
} from "@/types/xan";
import {
  collectVariablesFromPipeline,
  inferVariableType,
} from "@/utils/params";
import { useLanguage } from "@/i18n";

interface VariablePanelProps {
  steps: PipelineStep[];
  variables: PipelineVariable[];
  onChange: (variables: PipelineVariable[]) => void;
  onClose: () => void;
}

const TYPE_OPTIONS: PipelineVariableType[] = ["string", "number", "path"];

/** Right-drawer panel showing detected/declared pipeline variables with
 *  editable defaults and inferred types (F3). */
export function VariablePanel({
  steps,
  variables,
  onChange,
  onClose,
}: VariablePanelProps) {
  const { t } = useLanguage();
  // Panel list = declared variables (persistent) UNION referenced-but-undeclared
  // variables auto-detected from the pipeline.
  const referenced = collectVariablesFromPipeline(steps, variables);
  const declaredNames = new Set(variables.map((v) => v.name));
  const detected = [
    ...variables,
    ...referenced.filter((v) => !declaredNames.has(v.name)),
  ];
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  // Persistence only ever writes the *declared* `variables` list. Editing an
  // auto-detected (referenced) variable promotes it into the declared list.
  const upsertVariable = (name: string, patch: Partial<PipelineVariable>) => {
    const next = variables.some((v) => v.name === name)
      ? variables.map((v) => (v.name === name ? { ...v, ...patch } : v))
      : [...variables, { name, ...patch, type: patch.type ?? "string" }];
    onChange(next);
  };

  const setDefault = (name: string, value: string) => {
    upsertVariable(name, {
      defaultValue: value,
      type: inferVariableType(value),
    });
  };

  const setType = (name: string, type: PipelineVariableType) => {
    upsertVariable(name, { type });
  };

  const addVariable = () => {
    const name = newName.trim();
    if (!name) {
      setNotice(t.variableEmptyName);
      return;
    }
    if (detected.some((v) => v.name === name)) {
      setNotice(t.variableDuplicateName);
      return;
    }
    onChange([...variables, { name, defaultValue: "", type: "string" }]);
    setNotice(null);
    setNewName("");
  };

  const handleNameChange = (value: string) => {
    setNewName(value);
    if (notice) setNotice(null);
  };

  const deleteVariable = (name: string) => {
    onChange(variables.filter((v) => v.name !== name));
    setNotice(null);
  };

  const clearAll = () => {
    onChange([]);
    setConfirmingClear(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {t.variables}
        </h3>
        <div className="flex items-center gap-1">
          {variables.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingClear(true)}
              className="text-[11px] text-muted-foreground"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {t.clearAllVariables}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.close}
          >
            <X className="h-4 w-4 accent-foreground" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          {t.variablePlaceholderHint}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {detected.length === 0 ? (
          <p className="text-xs text-muted-foreground/70 mt-6 text-center">
            {t.noVariablesDetected}
          </p>
        ) : (
          <div className="space-y-2.5">
            {detected.map((v) => (
              <div
                key={v.name}
                className="rounded-lg border border-border/60 p-2.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <span className="text-muted-foreground/50">{"{{"}</span>
                    {v.name}
                    <span className="text-muted-foreground/50">{"}}"}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <SearchableSelect
                      value={v.type}
                      onChange={(ty) =>
                        setType(v.name, ty as PipelineVariableType)
                      }
                      options={TYPE_OPTIONS.map((ty) => ({
                        label: ty,
                        value: ty,
                      }))}
                      size="sm"
                      width="100px"
                    />
                    {declaredNames.has(v.name) && (
                      <button
                        onClick={() => deleteVariable(v.name)}
                        title={t.deleteVariable}
                        aria-label={t.deleteVariable}
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground/60 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={v.defaultValue ?? ""}
                  onChange={(e) => setDefault(v.name, e.target.value)}
                  placeholder={t.variableDefault}
                  className="w-full h-7 px-2.5 text-xs border rounded-md bg-background"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 border-t border-border/60">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addVariable()}
            placeholder={t.variableName}
            className="h-8 flex-1 min-w-0 px-2.5 text-sm border rounded-md bg-background"
          />
          <Button
            size="sm"
            onClick={addVariable}
            disabled={!newName.trim()}
            className="flex items-center gap-1 shrink-0 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.addVariable}
          </Button>
        </div>
        {notice && <p className="mt-1 text-[11px] text-red-500">{notice}</p>}
      </div>

      <ConfirmDialog
        isOpen={confirmingClear}
        title={t.clearAllVariables}
        message={t.confirmClearAllVariables}
        onConfirm={clearAll}
        onCancel={() => setConfirmingClear(false)}
      />
    </div>
  );
}
