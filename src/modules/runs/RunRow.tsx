import React from "react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { RunTimer } from "@/components/ui/RunTimer";
import { formatElapsed } from "@/utils/format";
import type { BranchRunState } from "@/types/execution";

interface RunRowProps {
  branch: BranchRunState;
  hasResult: boolean;
  /** A whole run cannot be re-run from one of its rows while it is in flight. */
  canRerun?: boolean;
  /** One branch can be re-run alone with the same selection model. */
  onRerun?: (index: number) => void;
  onOpenResult?: (index: number) => void;
}

/**
 * One branch in the bottom run panel (design 086 · A2). Status is a lamp plus
 * a word; the chain and the timings are mono, so a long list scans vertically.
 */
export const RunRow = React.memo(function RunRow({
  branch,
  hasResult,
  canRerun = true,
  onRerun,
  onOpenResult,
}: RunRowProps) {
  const { t } = useLanguage();
  const running = branch.status === "running";
  const done = branch.status === "done";
  const error = branch.status === "error";
  const cancelled = branch.status === "cancelled";
  const skipped = branch.status === "skipped";

  const statusLabel = running
    ? t.runStateRunning
    : done
      ? t.runStateDone
      : error
        ? t.runStateFailed
        : cancelled
          ? t.branchStateCancelled
          : skipped
            ? t.branchStateSkipped
            : t.branchStatePending;

  const currentStep = running
    ? branch.steps.find((step) => step.id === branch.currentStepId)?.name
    : undefined;

  return (
    <div
      data-branch-index={branch.index}
      data-status={branch.status}
      className={cn(
        "grid h-[34px] grid-cols-[34px_minmax(0,1fr)_84px_112px_58px_96px] items-center border-b border-border-soft px-3.5 text-[11.5px] last:border-b-0",
        error && "bg-danger/5",
      )}
    >
      <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
        {String(branch.index + 1).padStart(2, "0")}
      </span>

      <span className="flex min-w-0 items-center gap-1.5">
        {branch.steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <span className="text-[9px] text-muted-foreground/60">›</span>
            )}
            <span className="max-w-[130px] truncate text-foreground">
              {step.name}
            </span>
          </React.Fragment>
        ))}
      </span>

      <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 flex-none rounded-full",
            running && "bg-primary ring-[3px] ring-primary/10",
            done && "bg-success",
            error && "bg-danger",
            (cancelled || skipped) && "bg-muted-foreground/40",
            !running && !done && !error && !cancelled && !skipped &&
              "border border-muted-foreground/40 bg-transparent",
          )}
        />
        {statusLabel}
      </span>

      <span
        title={currentStep ?? (error ? branch.error : undefined)}
        className="truncate font-mono text-[9.5px] text-muted-foreground"
      >
        {currentStep ?? (error ? branch.error : "—")}
      </span>

      <span className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {running ? (
          <RunTimer
            running
            startedAt={branch.startedAt}
            className="text-[10px] [&_span:first-child]:text-[10px]"
          />
        ) : (
          formatElapsed(branch.durationMs) || "—"
        )}
      </span>

      <span className="flex justify-end gap-2.5 text-[10px] font-medium">
        {!running && hasResult && onOpenResult && (
          <button
            type="button"
            onClick={() => onOpenResult(branch.index)}
            className="text-primary transition-colors hover:text-primary/75"
          >
            {t.results}
          </button>
        )}
        {canRerun && !running && (done || error || cancelled) && onRerun && (
          <button
            type="button"
            onClick={() => onRerun(branch.index)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.runRerunBranch}
          </button>
        )}
      </span>
    </div>
  );
});
