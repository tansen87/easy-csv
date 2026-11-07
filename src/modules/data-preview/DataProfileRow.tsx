import React from "react";
import { ChevronDown } from "lucide-react";

import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  fmtCount,
  fmtStat,
  toNumber,
  type ColumnKind,
  type ProfileRow,
} from "@/modules/data-preview/profileStats";

/**
 * One column of the data profile panel (design 042).
 *
 * Two lines: name + missing count, then type + completeness ruler. The ruler's
 * dashed tail is the only place colour carries meaning — everything else is a
 * neutral step. Expanding reveals the statistics `xan stats` already returns.
 */

interface DataProfileRowProps {
  row: ProfileRow;
  open: boolean;
  onToggle: (field: string) => void;
}

function LengthRuler({ min, max }: { min: number; max: number }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="text-[10px] leading-[13px] text-muted-foreground">
        {t.profileLength}
      </div>
      <div className="relative mt-px h-2" aria-hidden="true">
        <span className="absolute right-0 bottom-[3px] left-0 h-px bg-border" />
        <span className="absolute bottom-px left-0 h-1.5 w-px bg-border" />
        <span className="absolute right-0 bottom-px h-1.5 w-px bg-border" />
        <span className="absolute bottom-0.5 left-1/4 h-[3px] w-px bg-border opacity-35" />
        <span className="absolute bottom-0.5 left-1/2 h-[3px] w-px bg-border opacity-35" />
        <span className="absolute bottom-0.5 left-3/4 h-[3px] w-px bg-border opacity-35" />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] tabular-nums text-muted-foreground">
        <span>
          {fmtCount(min)} {t.profileCharUnit}
        </span>
        <span>
          {fmtCount(max)} {t.profileCharUnit}
        </span>
      </div>
    </>
  );
}

export const DataProfileRow = React.memo(function DataProfileRow({
  row,
  open,
  onToggle,
}: DataProfileRowProps) {
  const { t } = useLanguage();
  const { stat, kind, filled, missing } = row;
  const hasMissing = missing > 0;

  const kindLabel: Record<ColumnKind, string> = {
    int: t.profileTypeInt,
    float: t.profileTypeFloat,
    text: t.profileTypeText,
    mixed: t.profileTypeMixed,
    empty: t.profileTypeEmpty,
  };

  const renderDetail = () => {
    if (kind === "empty") {
      return (
        <p className="text-[10.5px] leading-4 text-muted-foreground">
          {t.profileAllEmpty}
        </p>
      );
    }

    if (kind === "int" || kind === "float") {
      const decimals = kind === "float" ? 2 : 0;
      return (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              [t.min, fmtStat(stat.min, decimals)],
              [t.mean, fmtStat(stat.mean, 2)],
              [t.max, fmtStat(stat.max, decimals)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <span className="block text-[10px] leading-[14px] text-muted-foreground">
                  {label}
                </span>
                <b className="block truncate font-mono text-[11.5px] leading-[17px] font-medium tabular-nums">
                  {value}
                </b>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
            <span>{t.sum}</span>
            <b className="font-mono font-medium tabular-nums text-foreground">
              {fmtStat(stat.sum, decimals)}
            </b>
            <span className="text-muted-foreground/60">·</span>
            <span>{t.profileNonEmpty}</span>
            <b className="font-mono font-medium tabular-nums text-foreground">
              {fmtCount(filled)}
            </b>
          </div>
        </>
      );
    }

    // Text / mixed columns: length is the only range that stays meaningful, so
    // it gets the ruler and the lexical extremes stay as plain values.
    const lexMin = stat.lex_first || stat.min || "—";
    const lexMax = stat.lex_last || stat.max || "—";

    return (
      <>
        <LengthRuler
          min={toNumber(stat.min_length)}
          max={toNumber(stat.max_length)}
        />
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
          {hasMissing ? (
            <>
              <span>{t.profileNonEmpty}</span>
              <b className="font-mono font-medium tabular-nums text-foreground">
                {fmtCount(filled)}
              </b>
              <span className="text-muted-foreground/60">·</span>
              <span>{t.profileMissing}</span>
              <b className="font-mono font-medium tabular-nums text-foreground">
                {fmtCount(missing)}
              </b>
            </>
          ) : (
            <>
              <span>{t.min}</span>
              <b className="max-w-[80px] truncate font-mono font-medium text-foreground">
                {lexMin}
              </b>
              <span className="text-muted-foreground/60">·</span>
              <span>{t.max}</span>
              <b className="max-w-[80px] truncate font-mono font-medium text-foreground">
                {lexMax}
              </b>
            </>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(stat.field)}
        className={cn(
          "relative block w-full cursor-pointer py-[9px] pr-4 pl-8 text-left transition-colors",
          open ? "bg-muted" : "hover:bg-muted/60",
        )}
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "absolute top-[11px] left-4 h-3 w-3 text-muted-foreground/70 transition-transform duration-150",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
        <span className="flex items-baseline gap-2.5">
          <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[17px] font-medium">
            {stat.field}
          </span>
          {hasMissing && (
            <span className="flex shrink-0 items-baseline gap-1 text-[10px] leading-[17px] text-muted-foreground">
              {t.profileMissing}
              <b className="font-mono text-[10.5px] font-medium tabular-nums text-warning">
                {fmtCount(missing)}
              </b>
            </span>
          )}
        </span>
        <span className="mt-[7px] flex h-[13px] items-center gap-[9px]">
          <span className="w-8 shrink-0 text-[10.5px] leading-[13px] text-muted-foreground">
            {kindLabel[kind]}
          </span>
          <span
            aria-hidden="true"
            className="relative h-1 min-w-0 flex-1 bg-foreground/[0.06]"
          >
            <span
              className="absolute inset-y-0 left-0 bg-foreground/30"
              style={{ width: `${row.percent}%` }}
            />
            {hasMissing && (
              <span
                className="absolute inset-y-0 right-0"
                style={{
                  left: `${row.percent}%`,
                  backgroundImage:
                    "repeating-linear-gradient(90deg, var(--warning) 0 3px, transparent 3px 5px)",
                }}
              />
            )}
            <span className="absolute -top-0.5 left-0 h-2 w-px bg-foreground/20" />
            <span className="absolute -top-0.5 right-0 h-2 w-px bg-foreground/20" />
          </span>
        </span>
      </button>
      {open && (
        <div className="bg-muted pr-4 pb-[15px] pl-8">{renderDetail()}</div>
      )}
    </>
  );
});
