import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Check, ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import type { BranchSummary } from "@/types/execution";

interface BranchPickerProps {
  tabName: string;
  branches: BranchSummary[];
  outputPath?: string;
  selected: number[];
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onRun: (indexes: number[]) => void;
  onBack: () => void;
}

/**
 * Second level of the Execute menu (design 086 · A6).
 *
 * The compact sibling of the full-size plan page: same selection rules, but
 * 320px wide and only one risk line. The parent owns the open state; this
 * component owns focus and keyboard.
 */
export function BranchPicker({
  tabName,
  branches,
  outputPath,
  selected,
  onToggle,
  onSelectAll,
  onRun,
  onBack,
}: BranchPickerProps) {
  const { t } = useLanguage();
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected =
    branches.length > 0 && selected.length === branches.length;
  const noneSelected = selected.length === 0;

  // Enter the pane with the first branch focused: the menu opened by click,
  // so moving focus into the new surface is expected.
  useEffect(() => {
    rowRefs.current[0]?.focus();
  }, [branches]);

  const moveFocus = useCallback((direction: 1 | -1) => {
    const rows = rowRefs.current.filter(Boolean) as HTMLDivElement[];
    if (rows.length === 0) return;
    const current = rows.findIndex((row) => row === document.activeElement);
    const next =
      current < 0
        ? 0
        : (current + direction + rows.length) % rows.length;
    rows[next]?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    // Enter runs the current selection unless the target is one of the
    // ordinary buttons (back / run), which handle Enter themselves.
    if (
      event.key === "Enter" &&
      !(event.target as HTMLElement | null)?.closest(
        "button:not([data-branch-row])",
      )
    ) {
      event.preventDefault();
      if (!noneSelected) onRun(selected);
    }
  };

  const primaryLabel = noneSelected
    ? t.runNoSelection
    : allSelected
      ? t.runAllAction.replace("{count}", String(selected.length))
      : t.runSelectedAction.replace("{count}", String(selected.length));

  return (
    <div className="flex flex-col" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={onBack}
        className="flex h-7 w-full items-center gap-1 border-b border-border-soft px-2 text-left text-[10.5px] font-medium text-primary transition-colors hover:bg-foreground/5"
      >
        <ChevronLeft className="h-3 w-3" strokeWidth={1.6} />
        {t.runBackToTabs}
        <span className="ml-auto max-w-[150px] truncate text-[10px] font-normal text-muted-foreground">
          {tabName}
        </span>
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={allSelected ? true : noneSelected ? false : "mixed"}
        onClick={onSelectAll}
        className="flex h-6 w-full items-center gap-2 px-3 text-left text-[10.5px] text-foreground transition-colors hover:bg-foreground/5"
      >
        <span
          className={cn(
            "grid h-3.5 w-3.5 flex-none place-items-center rounded-[3px] border",
            allSelected
              ? "border-primary bg-primary text-primary-foreground"
              : noneSelected
                ? "border-border-strong bg-background"
                : "border-primary bg-background",
          )}
        >
          {allSelected && <Check className="h-2.5 w-2.5" strokeWidth={2.6} />}
          {!allSelected && !noneSelected && (
            <span className="h-[1.5px] w-2 rounded-full bg-primary" />
          )}
        </span>
        {t.runSelectAll}
        <span className="ml-auto font-mono text-[9.5px] tabular-nums text-muted-foreground">
          {t.runSelectedCount
            .replace("{selected}", String(selected.length))
            .replace("{total}", String(branches.length))}
        </span>
      </button>

      <div className="border-y border-border-soft">
        {branches.map((branch, index) => {
          const checked = selectedSet.has(branch.index);
          return (
            <div
              key={branch.index}
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              role="checkbox"
              tabIndex={0}
              aria-checked={checked}
              data-branch-row
              onClick={() => onToggle(branch.index)}
              onKeyDown={(event) => {
                // Space toggles; Enter is owned by the pane (run selection).
                if (event.key === " ") {
                  event.preventDefault();
                  onToggle(branch.index);
                }
              }}
              className={cn(
                "group grid h-8 w-full cursor-pointer grid-cols-[14px_20px_minmax(0,1fr)_58px] items-center gap-1.5 border-b border-border-soft px-3 text-left outline-none transition-colors last:border-b-0 hover:bg-foreground/4 focus-visible:ring-2 focus-visible:ring-ring/40",
                !checked && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-3.5 w-3.5 place-items-center rounded-[3px] border",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-strong bg-background",
                )}
              >
                {checked && (
                  <Check className="h-2.5 w-2.5" strokeWidth={2.6} />
                )}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                {String(branch.index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 truncate text-[11px] text-foreground">
                {branch.stepNames.join(" › ")}
              </span>
              <span className="flex items-center justify-end">
                <span className="font-mono text-[9px] tabular-nums text-muted-foreground group-hover:hidden">
                  {branch.stepIds.length}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRun([branch.index]);
                  }}
                  className="hidden text-[9.5px] font-medium text-primary group-hover:block"
                >
                  {t.runOnlyThis}
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {outputPath && selected.length > 0 && (
        <div
          title={outputPath}
          className={cn(
            "flex h-[22px] items-center gap-1.5 px-3 text-[10px]",
            selected.length > 1
              ? "text-warning"
              : "text-muted-foreground",
          )}
        >
          <span className="h-1 w-1 flex-none rounded-full bg-current" />
          <span className="min-w-0 truncate">
            {selected.length > 1
              ? t.runOutputConflict
                  .replace("{path}", shortPath(outputPath))
                  .replace("{count}", String(selected.length))
              : t.runOutputSingle.replace("{path}", shortPath(outputPath))}
          </span>
        </div>
      )}

      <div className="flex h-9 items-center gap-2 border-t border-border-soft px-2">
        <span className="truncate text-[9.5px] text-muted-foreground">
          {t.runNoSelectionHint}
        </span>
        <button
          type="button"
          disabled={noneSelected}
          onClick={() => onRun(selected)}
          className="ml-auto h-6 flex-none rounded-[5px] bg-primary px-2.5 text-[10.5px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground/60"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

/** Keep the picker's risk line to one row; the full path stays in `title`. */
function shortPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}
