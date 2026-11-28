import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

import { useLanguage } from "@/i18n";
import { Tooltip } from "@/components/ui/Tooltip";
import { ScrollArea } from "@/components/ui/ScrollArea";
import type { ResultPreview } from "@/types/execution";
import { ResultTable } from "@/modules/results/ResultTable";
import {
  stripLeadingIndex,
  toCsvText,
  toMarkdownText,
} from "@/modules/results/lib/resultTable";

type CopyFormat = "csv" | "md";

interface ResultMetaProps {
  result: ResultPreview;
  index: number;
}

/**
 * Chain + counts + copy, rendered **inside the dock's tab row** (design 084
 * feedback: two stacked head rows cost 32px for very little).
 *
 * The title is an index chain (`01 › 02 › 03`), not a sentence: the old single
 * truncated line could not answer "which steps produced this". Copy is one
 * action with a format menu, because `CSV` / `MD` as two bare labels asked the
 * user to decode an abbreviation first.
 *
 * Returns a fragment: the dock supplies the flex row it sits in.
 */
export const ResultMeta = React.memo(function ResultMeta({
  result,
  index,
}: ResultMetaProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState<CopyFormat | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const copy = useCallback(
    async (format: CopyFormat) => {
      const text =
        format === "csv"
          ? toCsvText(result.headers, result.rows)
          : toMarkdownText(result.headers, result.rows);
      try {
        await navigator.clipboard.writeText(text);
        setCopied(format);
        setMenuOpen(false);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(null), 3000);
      } catch {
        // Clipboard unavailable (permissions / non-secure context): stay quiet
        // rather than claim success.
      }
    },
    [result.headers, result.rows],
  );

  const meta = useMemo(() => {
    const template = result.truncated
      ? t.resultRowsColsTruncated
      : t.resultRowsCols;
    return template
      .replace("{rows}", String(result.totalRows))
      .replace("{cols}", String(result.headers.length));
  }, [result.headers.length, result.totalRows, result.truncated, t]);

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {result.steps.length > 0 ? (
          result.steps.map((step, stepIndex) => (
            <React.Fragment key={`${step}-${stepIndex}`}>
              {stepIndex > 0 && (
                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                  ›
                </span>
              )}
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 rounded-[3px] bg-muted px-1 font-mono text-[9.5px] leading-4 text-muted-foreground">
                  {String(stepIndex + 1).padStart(2, "0")}
                </span>
                <span
                  className="max-w-[132px] truncate text-[11.5px] text-foreground"
                  title={step}
                >
                  {stripLeadingIndex(step, stepIndex + 1)}
                </span>
              </span>
            </React.Fragment>
          ))
        ) : (
          <span className="truncate text-[11.5px] text-muted-foreground">
            {t.results} {index + 1}
          </span>
        )}
      </div>

      {result.truncated ? (
        <Tooltip content={t.resultTruncated}>
          <span className="shrink-0 cursor-default font-mono text-[11px] tabular-nums text-muted-foreground">
            {meta}
          </span>
        </Tooltip>
      ) : (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {meta}
        </span>
      )}

      <div className="relative flex shrink-0 items-center" ref={menuRef}>
        {/* The app's tooltip, not a native `title`: same delay, size and
            placement as every other icon button in the dock. */}
        <Tooltip content={copied ? t.copied : t.copyCsv}>
          <button
            type="button"
            onClick={() => void copy("csv")}
            aria-label={t.copyCsv}
            className="flex h-6 items-center rounded-l-[5px] pl-1.5 pr-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
        <Tooltip content={t.copyFormat}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t.copy}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-6 items-center rounded-r-[5px] pl-0.5 pr-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </Tooltip>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[26px] z-20 w-[188px] rounded-md border border-border bg-popover p-1 shadow-md"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => void copy("csv")}
              className="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[11.5px] text-foreground hover:bg-muted"
            >
              <Copy className="h-3 w-3 text-muted-foreground" />
              {t.copyCsv}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void copy("md")}
              className="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[11.5px] text-foreground hover:bg-muted"
            >
              <Copy className="h-3 w-3 text-muted-foreground" />
              {t.copyMarkdown}
            </button>
          </div>
        )}
      </div>
    </>
  );
});

interface ResultsPanelProps {
  result: ResultPreview;
}

/**
 * The ledger body of one branch's result (design 084). The chain, counts and
 * copy live in the dock's tab row ({@link ResultMeta}); this component owns the
 * table only — scrollbars come from the app's `ScrollArea`, not a native
 * `overflow-auto`, so both orientations match every other scroller.
 */
export const ResultsPanel = React.memo(function ResultsPanel({
  result,
}: ResultsPanelProps) {
  return (
    <ScrollArea className="min-h-0 flex-1" data-testid="results-panel">
      <ResultTable headers={result.headers} rows={result.rows} />
    </ScrollArea>
  );
});
