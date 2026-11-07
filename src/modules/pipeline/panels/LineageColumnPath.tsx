import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { ColumnTrace, TraceStep } from "@/modules/pipeline/panels/lib/columnLineage";

interface LineageColumnPathProps {
  trace: ColumnTrace;
  resultRows: number;
  resultColumns: number;
  onOpenGraph: () => void;
}

const FILLED_DOT = "bg-primary border-primary";
const HOLLOW_DOT =
  "border-[color-mix(in_oklab,var(--foreground)_26%,transparent)] bg-muted";

/**
 * 一列的血缘路径：源 → 每一步 → 结果。
 *
 * 没动过这一列的步骤压成一行（只写「保留」），动过的展开成两行，
 * 这样 320px 的宽度里先看到「哪几步动过」。
 */
export function LineageColumnPath({
  trace,
  resultRows,
  resultColumns,
  onOpenGraph,
}: LineageColumnPathProps) {
  const { t } = useLanguage();

  const stepLabel = (step: TraceStep) => {
    switch (step.kind) {
      case "cast":
        return t.lineageCast;
      case "derived":
        return t.lineageDerived;
      case "renamed":
        return t.lineageRenamed;
      case "removed":
        return t.lineageRemoved;
      default:
        return t.lineageKept;
    }
  };

  const stepValue = (step: TraceStep) => {
    if (step.kind === "cast") {
      return (
        <>
          {step.typeIn}
          <span className="px-1 text-muted-foreground/60">→</span>
          <b className="font-normal text-primary">{step.typeOut}</b>
        </>
      );
    }
    if (step.kind === "derived") {
      return (
        <>
          <b className="font-normal text-primary">{step.columnOut}</b>
          {step.expression && (
            <code className="ml-1.5 rounded bg-card/70 px-1 py-px font-mono text-[10px]">
              {step.expression}
            </code>
          )}
        </>
      );
    }
    if (step.kind === "renamed") {
      return (
        <>
          {step.columnIn}
          <span className="px-1 text-muted-foreground/60">→</span>
          <b className="font-normal text-primary">{step.columnOut}</b>
        </>
      );
    }
    if (step.kind === "removed") {
      return (
        <span className="text-muted-foreground">{t.lineageRemovedHint}</span>
      );
    }
    return null;
  };

  return (
    <div className="bg-muted px-4 pb-3 pt-1.5">
      <div className="flex h-6 items-center gap-2 text-[10.5px] text-muted-foreground">
        {t.lineagePath}
        <span className="ml-auto font-mono text-[9.5px] text-muted-foreground/60">
          Esc
        </span>
      </div>

      <PathRow first dotClass={FILLED_DOT}>
        <div className="flex min-h-[18px] items-baseline gap-1.5">
          <span className="truncate text-[12px] font-medium">
            {t.lineageSourceNode}
          </span>
        </div>
        <div className="mt-0.5 flex gap-2 text-[11px] leading-4">
          <span className="w-[26px] flex-none text-[10px] text-muted-foreground/60">
            {t.lineageSourceColumn}
          </span>
          <span className="min-w-0 truncate text-muted-foreground">
            {trace.sourceName} ·{" "}
            <span className="font-mono text-[10px]">{trace.sourceType}</span>
          </span>
        </div>
      </PathRow>

      {trace.steps.map((step) => {
        const compact = step.kind === "kept";
        const right = compact
          ? step.groupKey
            ? t.lineageGroupKey
            : t.lineageKept
          : `${step.rowCountIn} → ${step.rowCountOut} ${t.lineageRowsUnit}`;
        return (
          <PathRow
            key={`${step.stepId}-${step.index}`}
            dotClass={
              step.kind === "kept" || step.kind === "removed"
                ? HOLLOW_DOT
                : FILLED_DOT
            }
            small={compact}
          >
            <div className="flex min-h-[18px] items-baseline gap-1.5">
              <span className="font-mono text-[9.5px] text-muted-foreground/60">
                {String(step.index).padStart(2, "0")}
              </span>
              <span className="min-w-0 truncate text-[12px]">
                {step.alias || step.commandName}
              </span>
              {step.alias && (
                <span className="flex-none font-mono text-[9.5px] text-muted-foreground/60">
                  {step.commandName}
                </span>
              )}
              <span
                className={cn(
                  "ml-auto whitespace-nowrap tabular-nums",
                  compact
                    ? "text-[10px] text-muted-foreground/70"
                    : "font-mono text-[9.5px] text-muted-foreground",
                )}
              >
                {right}
              </span>
            </div>
            {!compact && (
              <div className="mt-0.5 flex gap-2 text-[11px] leading-4">
                <span className="w-[26px] flex-none text-[10px] text-muted-foreground/60">
                  {stepLabel(step)}
                </span>
                <span className="min-w-0 truncate text-foreground">
                  {stepValue(step)}
                </span>
              </div>
            )}
          </PathRow>
        );
      })}

      {trace.survives ? (
        <PathRow last dotClass={FILLED_DOT}>
          <div className="flex min-h-[18px] items-baseline gap-1.5">
            <span className="text-[12px] font-medium">
              {t.lineageResultNode}
            </span>
            <span className="ml-auto whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">
              {resultRows} {t.lineageRowsUnit} · {resultColumns}{" "}
              {t.lineageColumnsUnit}
            </span>
          </div>
          <div className="mt-0.5 flex gap-2 text-[11px] leading-4">
            <span className="w-[26px] flex-none text-[10px] text-muted-foreground/60">
              {t.lineageResultColumn}
            </span>
            <span className="min-w-0 truncate text-muted-foreground">
              {trace.finalName} ·{" "}
              <span className="font-mono text-[10px]">
                {trace.finalType || trace.type}
              </span>
            </span>
          </div>
        </PathRow>
      ) : (
        <PathRow last dotClass={HOLLOW_DOT} terminal>
          <div className="flex min-h-[18px] items-baseline gap-1.5">
            <span className="text-[12px] text-muted-foreground">
              {t.lineagePathEnd}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground/70">
            {t.lineagePathEndHint}
          </div>
        </PathRow>
      )}

      <div className="pl-6 pt-1.5">
        <button
          type="button"
          onClick={onOpenGraph}
          className="flex items-center gap-1 text-[10.5px] text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          {t.lineageViewInGraph}
        </button>
      </div>
    </div>
  );
}

interface PathRowProps {
  children: React.ReactNode;
  dotClass: string;
  first?: boolean;
  last?: boolean;
  small?: boolean;
  terminal?: boolean;
}

function PathRow({
  children,
  dotClass,
  first,
  last,
  small,
  terminal,
}: PathRowProps) {
  return (
    <div className="relative py-1.5 pl-6">
      <span
        aria-hidden="true"
        className="absolute left-[6px] w-px bg-border"
        style={{
          top: first ? 15 : 0,
          bottom: last ? "calc(100% - 15px)" : 0,
        }}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute z-[1] rounded-full border",
          dotClass,
          small
            ? "left-[3px] top-[11px] h-[7px] w-[7px]"
            : "left-[2px] top-[9px] h-[9px] w-[9px]",
          terminal && "bg-muted",
        )}
      />
      {children}
    </div>
  );
}
