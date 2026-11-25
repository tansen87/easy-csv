import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { TallyMark } from "@/components/ui/TallyMark";
import { useLanguage } from "@/i18n";
import type { Translations } from "@/i18n/translations/types";
import {
  LEDGER_MILESTONES,
  type LedgerMilestoneId,
  type LedgerState,
} from "@/hooks/useLedger";

/** Mark id → i18n key for its name. */
export const LEDGER_MARK_LABELS: Record<LedgerMilestoneId, keyof Translations> =
  {
    "first-run": "ledgerMarkFirstRun",
    "rows-10k": "ledgerMarkRows10k",
    "rows-100k": "ledgerMarkRows100k",
    "rows-1m": "ledgerMarkRows1m",
    "rows-10m": "ledgerMarkRows10m",
    "runs-10": "ledgerMarkRuns10",
    "runs-100": "ledgerMarkRuns100",
    "pipeline-1": "ledgerMarkPipeline1",
    "pipeline-10": "ledgerMarkPipeline10",
    "commands-10": "ledgerMarkCommands10",
    "template-first": "ledgerMarkTemplateFirst",
    "step-run-first": "ledgerMarkStepRunFirst",
  };

function formatCount(value: number, isZh: boolean): string {
  return value.toLocaleString(isZh ? "zh-CN" : "en-US");
}

/** Total run time, rounded to minutes ("4 小时 12 分" / "4 h 12 min"). */
export function formatLedgerDuration(ms: number, t: Translations): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) {
    return t.ledgerDurationMinutes.replace("{m}", String(minutes));
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? t.ledgerDurationHours.replace("{h}", String(hours))
    : t.ledgerDurationHourMinutes
        .replace("{h}", String(hours))
        .replace("{m}", String(rest));
}

interface LedgerMilestoneToastProps {
  unlock: LedgerMilestoneId;
  state: LedgerState;
  /** Queue advance (also used by the close button / auto-dismiss). */
  onDismiss: () => void;
  onViewLedger: () => void;
}

/**
 * One milestone, 5 s (design 079 §4.2). No confetti, no modal, no sound: a
 * tally mark, the number that was crossed, and who you were when you crossed
 * it (runs + total time).
 */
export function LedgerMilestoneToast({
  unlock,
  state,
  onDismiss,
  onViewLedger,
}: LedgerMilestoneToastProps) {
  const { t, effectiveLanguage } = useLanguage();
  const isZh = effectiveLanguage === "zh";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const hide = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onDismiss, 240);
    }, 5000);
    return () => window.clearTimeout(hide);
  }, [onDismiss]);

  const def = LEDGER_MILESTONES.find((entry) => entry.id === unlock);
  const name = t[LEDGER_MARK_LABELS[unlock]];
  const value =
    def && def.kind !== "flag"
      ? (def.kind === "rows"
          ? t.ledgerRowsValue
          : def.kind === "runs"
            ? t.ledgerRunsValue
            : def.kind === "pipelines"
              ? t.ledgerPipelinesValue
              : t.ledgerCommandsValue
        ).replace("{value}", formatCount(def.threshold, isZh))
      : name;

  const description = t.ledgerMilestoneDesc
    .replace("{runs}", formatCount(state.totals.runs, isZh))
    .replace("{duration}", formatLedgerDuration(state.totals.ms, t));

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-4 z-50 w-[306px] overflow-hidden rounded-[10px] border border-border bg-card shadow-lg transition-[opacity,transform] duration-200 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      }`}
      style={{ bottom: "calc(var(--log-drawer-height, 0px) + 48px)" }}
    >
      <div className="px-3.5 pt-3.5 pb-3">
        <div className="flex items-start gap-2.5">
          <TallyMark className="mt-[3px] h-[22px] w-[24px]" />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 font-mono text-[9.5px] tracking-[0.03em] text-muted-foreground/70">
              {t.ledgerMilestoneEyebrow}
            </div>
            <div className="truncate font-mono text-[22px] font-medium leading-[1.15] tracking-tight tabular-nums">
              {value}
            </div>
          </div>
          <button
            type="button"
            aria-label={t.close}
            onClick={onDismiss}
            className="ml-1 grid h-5 w-5 flex-none place-items-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={onViewLedger}
        className="flex h-8 w-full items-center border-t border-border-soft px-3.5 text-left text-[11px] text-primary transition-colors hover:bg-muted/40"
      >
        {t.ledgerView}
      </button>
    </div>
  );
}
