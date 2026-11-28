import React from "react";

import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { RunRow } from "@/modules/runs/RunRow";
import type { BranchRunState } from "@/types/execution";

interface RunMetaProps {
  branches: BranchRunState[];
}

/**
 * Facts for the active run, rendered inside the dock's tab row (design 086).
 * One accent per state would be noise; lamps stay quiet and the counts are mono.
 */
export const RunMeta = React.memo(function RunMeta({
  branches,
}: RunMetaProps) {
  const { t } = useLanguage();
  const running = branches.filter((b) => b.status === "running").length;
  const done = branches.filter((b) => b.status === "done").length;
  const failed = branches.filter((b) => b.status === "error").length;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 font-mono text-[10px] text-muted-foreground">
      {running > 0 && (
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary ring-[3px] ring-primary/10" />
          <b className="font-normal text-foreground">{running}</b>
          {t.runStateRunning}
        </span>
      )}
      {done > 0 && (
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <b className="font-normal text-foreground">{done}</b>
          {t.runStateDone}
        </span>
      )}
      {failed > 0 && (
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
          <b className="font-normal text-foreground">{failed}</b>
          {t.runStateFailed}
        </span>
      )}
    </div>
  );
});

interface RunPanelProps {
  branches: BranchRunState[];
  unselectedCount: number;
  unselectedIndexes: number[];
  hasResult: (branchIndex: number) => boolean;
  onOpenResult?: (branchIndex: number) => void;
  onRerun?: (branchIndex: number) => void;
  onRunRemaining?: (indexes: number[]) => void;
  /** Whole-run cancel; per-branch cancel is not available in this P0. */
  onCancelRun?: () => void;
}

/**
 * The selected branches of the current run (design 086 · A2). This panel never
 * lists branches the user did not pick; a single footer line owns "run remaining".
 */
export function RunPanel({
  branches,
  unselectedCount,
  unselectedIndexes,
  hasResult,
  onOpenResult,
  onRerun,
  onRunRemaining,
  onCancelRun,
}: RunPanelProps) {
  const { t } = useLanguage();
  const running = branches.some((branch) => branch.status === "running");

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="run-panel">
      <ScrollArea className="min-h-0 flex-1">
        {branches.map((branch) => (
          <RunRow
            key={branch.index}
            branch={branch}
            hasResult={hasResult(branch.index)}
            canRerun={!running}
            onRerun={onRerun}
            onOpenResult={onOpenResult}
          />
        ))}
      </ScrollArea>

      {(unselectedCount > 0 || (running && onCancelRun)) && (
        <div className="flex h-[30px] flex-none items-center gap-2 border-t border-border-soft bg-muted/30 px-3.5 text-[10.5px] text-muted-foreground">
          {unselectedCount > 0 ? (
            <>
              <span>
                {t.runUnselectedHint.replace(
                  "{count}",
                  String(unselectedCount),
                )}
              </span>
              <button
                type="button"
                disabled={
                  running || !onRunRemaining || unselectedIndexes.length === 0
                }
                onClick={() => onRunRemaining?.(unselectedIndexes)}
                className="ml-auto font-medium text-primary transition-colors hover:text-primary/75 disabled:cursor-default disabled:text-muted-foreground/50"
              >
                {t.runRemaining}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCancelRun}
              className={cn(
                "ml-auto font-medium text-danger transition-colors hover:text-danger/75",
              )}
            >
              {t.cancelExecution}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
