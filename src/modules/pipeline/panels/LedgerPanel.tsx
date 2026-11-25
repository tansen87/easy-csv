import { DockHeader } from "@/components/ui/DockHeader";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { TallyMark } from "@/components/ui/TallyMark";
import { useLanguage } from "@/i18n";
import {
  LEDGER_MILESTONES,
  lastWeekActivity,
  weeklyRows,
  type LedgerMilestoneDef,
  type LedgerState,
} from "@/hooks/useLedger";
import { LEDGER_MARK_LABELS } from "@/modules/pipeline/overlays/LedgerMilestoneToast";

interface LedgerPanelProps {
  state: LedgerState;
  onClose: () => void;
}

function formatCount(value: number, isZh: boolean): string {
  return value.toLocaleString(isZh ? "zh-CN" : "en-US");
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * 「历程」 dock panel (design 079 §4.3): one large total, three facts, eight
 * weeks of rows, this week's rhythm, then the twelve marks. No rings, no
 * streaks, no targets — it is a record, not a scoreboard.
 */
export function LedgerPanel({ state, onClose }: LedgerPanelProps) {
  const { t, effectiveLanguage } = useLanguage();
  const isZh = effectiveLanguage === "zh";

  const unlockedCount = LEDGER_MILESTONES.filter(
    (def) => state.milestones[def.id],
  ).length;
  const weeks = weeklyRows(state.days);
  const weekMax = Math.max(...weeks, 0);
  const activity = lastWeekActivity(state.days);
  const activeDays = activity.filter(Boolean).length;

  const thresholdText = (def: LedgerMilestoneDef) => {
    switch (def.kind) {
      case "commands":
        return `${state.commands.length} / ${def.threshold}`;
      case "flag":
        return "—";
      default:
        return formatCount(def.threshold, isZh);
    }
  };

  return (
    <div
      className="flex h-full flex-col bg-card"
      onContextMenu={(event) => event.preventDefault()}
    >
      <DockHeader title={t.ledger} closeLabel={t.close} onClose={onClose} />

      {state.totals.runs === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <TallyMark muted className="h-6 w-6" />
          <p className="text-xs font-medium text-foreground">{t.ledgerEmpty}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t.ledgerEmptyHint}
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1" blockContent hideHorizontalScrollbar>
          <div className="px-3.5 pt-3">
            <div className="font-mono text-[30px] leading-none font-medium tracking-tight tabular-nums">
              {formatCount(state.totals.rows, isZh)}
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              {t.ledgerTotalRows}
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-border-soft pt-3">
              {[
                { value: state.totals.runs, label: t.ledgerRuns },
                { value: state.totals.files, label: t.ledgerFiles },
                { value: state.commands.length, label: t.ledgerCommands },
              ].map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <div className="font-mono text-[13px] leading-tight tabular-nums">
                    {formatCount(stat.value, isZh)}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3.5 border-t border-border-soft pt-3">
              <div className="flex items-baseline gap-2 font-mono text-[10px] tracking-[0.02em] text-muted-foreground/70">
                {t.ledgerWeeks}
              </div>
              <div className="mt-2.5 flex h-[52px] items-end gap-1.5">
                {weeks.map((value, index) => {
                  const height =
                    weekMax > 0 ? Math.max(2, Math.round((value / weekMax) * 52)) : 2;
                  return (
                    <div
                      key={index}
                      className={`flex-1 rounded-t-[2px] ${
                        index === weeks.length - 1
                          ? "bg-primary"
                          : "bg-foreground/15"
                      }`}
                      style={{ height }}
                      title={formatCount(value, isZh)}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {activity.map((active, index) => (
                  <span
                    key={index}
                    className={`h-1.5 w-1.5 rounded-full ${
                      active ? "bg-primary" : "bg-foreground/12"
                    }`}
                  />
                ))}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                  {t.ledgerWeekDays.replace("{n}", String(activeDays))}
                </span>
              </div>
            </div>

            <div className="mt-3.5 border-t border-border-soft pt-3 pb-3">
              <div className="flex items-baseline gap-2 font-mono text-[10px] tracking-[0.02em] text-muted-foreground/70">
                {t.ledgerMarks}
                <span className="ml-auto text-muted-foreground/50">
                  {t.ledgerMarksCount
                    .replace("{done}", String(unlockedCount))
                    .replace("{total}", String(LEDGER_MILESTONES.length))}
                </span>
              </div>
              <div className="mt-1">
                {LEDGER_MILESTONES.map((def) => {
                  const at = state.milestones[def.id];
                  return (
                    <div
                      key={def.id}
                      className="flex h-8 items-center gap-2.5 text-[11.5px]"
                    >
                      <TallyMark muted={!at} className="h-[15px] w-[16px]" />
                      <span
                        className={
                          at ? "text-foreground" : "text-muted-foreground/70"
                        }
                      >
                        {t[LEDGER_MARK_LABELS[def.id]]}
                      </span>
                      <span
                        className={`ml-auto font-mono text-[10px] tabular-nums ${
                          at ? "text-primary" : "text-muted-foreground/50"
                        }`}
                      >
                        {at ? shortDate(at) : thresholdText(def)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
