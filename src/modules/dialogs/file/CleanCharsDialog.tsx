import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { RunTimer } from "@/components/ui/RunTimer";
import { useLanguage } from "@/i18n";
import { useCsvProbe } from "@/hooks/useCsvProbe";
import { formatDateTime, formatElapsed } from "@/utils/format";
import {
  clearLastCleanCharsResult,
  loadLastCleanCharsResult,
  saveLastCleanCharsResult,
  type StoredCleanCharsResult,
} from "@/utils/cleanCharsHistory";
import type { ToastType } from "@/components/setting/Toast";

export interface CleanCharsResult {
  output_path: string;
  rows: number;
  removed_chars: number;
  replaced_chars: number;
  unclosed_lines: number;
  elapsed_ms?: number;
}

/** Header fields shown in the preview line. */
const HEADER_PREVIEW_FIELDS = 8;

/** Placeholder file used by the rule line before one is picked. */
const EXAMPLE_FILE = "orders.csv";

/** `{stem}_clean{ext}`, next to the input. */
function defaultOutputPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "") return "";
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const dot = trimmed.lastIndexOf(".");
  if (dot > slash) {
    return `${trimmed.slice(0, dot)}_clean${trimmed.slice(dot)}`;
  }
  return `${trimmed}_clean`;
}

/** File name shown in messages and the rule line. */
function baseName(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "") return EXAMPLE_FILE;
  return trimmed.split(/[\\/]/).pop() || trimmed;
}

/** Numbered step card — same skeleton as the other file tools. */
function StepSection({
  index,
  title,
  aside,
  children,
}: {
  index: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/50 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
          {index}
        </span>
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        {aside && (
          <span className="ml-auto text-[10.5px] text-muted-foreground">
            {aside}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** One cell of the result summary grid (label on top, value below). */
function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className="rounded-md bg-muted/60 p-2 min-w-0"
    >
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p
        className="text-base font-medium text-foreground truncate"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

interface CleanCharsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
  onShowToast?: (message: string, type?: ToastType) => void;
}

export function CleanCharsDialog({
  isOpen,
  onClose,
  initialInputFile,
  onShowToast,
}: CleanCharsDialogProps) {
  const { t } = useLanguage();
  const [inputFile, setInputFile] = useState("");
  const [outputFile, setOutputFile] = useState("");
  const [removeCr, setRemoveCr] = useState(true);
  const [mergeBlankLines, setMergeBlankLines] = useState(true);
  const [tabToSpace, setTabToSpace] = useState(true);
  const [removeQuotes, setRemoveQuotes] = useState(true);
  const [customChars, setCustomChars] = useState("");
  const [mergeQuotedNewlines, setMergeQuotedNewlines] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<StoredCleanCharsResult | null>(
    null,
  );
  const [isStaleResult, setIsStaleResult] = useState(false);
  const [outputExists, setOutputExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  /** Once the user edits the output path, stop deriving it from the input. */
  const outputTouchedRef = useRef(false);

  const clearFeedback = useCallback(() => {
    setError(null);
    setIsStaleResult(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const stored = loadLastCleanCharsResult();
    setInputFile(initialInputFile || stored?.inputFile || "");
    setOutputFile("");
    outputTouchedRef.current = false;
    setRemoveCr(stored?.removeCr ?? true);
    setMergeBlankLines(stored?.mergeBlankLines ?? true);
    setTabToSpace(stored?.tabToSpace ?? true);
    setRemoveQuotes(stored?.removeQuotes ?? true);
    setCustomChars(stored?.customChars ?? "");
    setMergeQuotedNewlines(stored?.mergeQuotedNewlines ?? false);
    setLastResult(stored);
    setIsStaleResult(stored !== null);
    setError(null);
  }, [isOpen, initialInputFile]);

  // Follow the input until the output field is edited by hand.
  useEffect(() => {
    if (!isOpen || outputTouchedRef.current) return;
    setOutputFile(defaultOutputPath(inputFile));
  }, [isOpen, inputFile]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const { probe, error: probeError, isProbing } = useCsvProbe({
    inputFile,
    fallbackDelimiter: ",",
    quoting: false,
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen || !lastResult) {
      setOutputExists(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const exists = await invoke<boolean>("file_exists", {
          filePath: lastResult.outputPath,
        });
        if (!cancelled) setOutputExists(exists);
      } catch {
        if (!cancelled) setOutputExists(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, lastResult]);

  const browseInput = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV", extensions: ["csv", "txt", "tsv"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (file) {
      clearFeedback();
      outputTouchedRef.current = false;
      setInputFile(file);
    }
  }, [clearFeedback]);

  const browseOutput = useCallback(async () => {
    const file = await save({
      defaultPath: outputFile || undefined,
      filters: [
        { name: "CSV", extensions: ["csv", "txt", "tsv"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (file) {
      clearFeedback();
      outputTouchedRef.current = true;
      setOutputFile(file);
    }
  }, [clearFeedback, outputFile]);

  const customCharsTrimmed = customChars.trim();
  const selectedCount =
    (removeCr ? 1 : 0) +
    (mergeBlankLines ? 1 : 0) +
    (tabToSpace ? 1 : 0) +
    (removeQuotes ? 1 : 0) +
    (customCharsTrimmed !== "" ? 1 : 0);
  const hasAction = selectedCount > 0 || mergeQuotedNewlines;
  const canRun = inputFile.trim() !== "" && outputFile.trim() !== "" && hasAction;

  const ruleSummary = useMemo(() => {
    const parts = [
      removeQuotes ? t.cleanCharsRuleQuotes : null,
      removeCr ? t.cleanCharsRuleCr : null,
      mergeBlankLines ? t.cleanCharsRuleBlank : null,
      tabToSpace ? t.cleanCharsRuleTab : null,
      customCharsTrimmed !== ""
        ? t.cleanCharsRuleCustom.replace("{chars}", customCharsTrimmed)
        : null,
      mergeQuotedNewlines ? t.cleanCharsRuleMergeQuoted : null,
    ].filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(" · ") : t.cleanCharsRuleNone;
  }, [
    removeQuotes,
    removeCr,
    mergeBlankLines,
    tabToSpace,
    customCharsTrimmed,
    mergeQuotedNewlines,
    t,
  ]);

  const headerPreview = useMemo(() => {
    if (!probe) return "";
    const shown = probe.header
      .slice(0, HEADER_PREVIEW_FIELDS)
      .map((field) => field || "∅")
      .join(" | ");
    return probe.header.length > HEADER_PREVIEW_FIELDS ? `${shown} …` : shown;
  }, [probe]);

  const handleOpenPath = useCallback(async () => {
    if (!lastResult) return;
    try {
      await invoke("reveal_paths", { paths: [lastResult.outputPath] });
    } catch (err) {
      onShowToast?.(String(err), "error");
    }
  }, [lastResult, onShowToast]);

  const handleClearRecord = useCallback(() => {
    clearLastCleanCharsResult();
    setLastResult(null);
    setIsStaleResult(false);
  }, []);

  const handleRun = useCallback(async () => {
    if (!inputFile.trim()) {
      setError(t.cleanCharsSelectFile);
      return;
    }
    if (!outputFile.trim()) {
      setError(t.cleanCharsSelectOutput);
      return;
    }
    if (inputFile.trim() === outputFile.trim()) {
      setError(t.cleanCharsSamePath);
      return;
    }
    if (!hasAction) {
      setError(t.cleanCharsNoOptionSelected);
      return;
    }

    clearFeedback();
    setIsRunning(true);
    try {
      const data = await invoke<CleanCharsResult>("clean_special_chars", {
        path: inputFile.trim(),
        outPath: outputFile.trim(),
        removeCr,
        mergeBlankLines,
        tabToSpace,
        removeQuotes,
        customChars: customCharsTrimmed,
        mergeQuotedNewlines,
      });
      const stored: StoredCleanCharsResult = {
        outputPath: data.output_path,
        rows: data.rows,
        removedChars: data.removed_chars,
        replacedChars: data.replaced_chars,
        unclosedLines: data.unclosed_lines,
        finishedAt: new Date().toISOString(),
        elapsedMs: data.elapsed_ms,
        inputFile: inputFile.trim(),
        removeCr,
        mergeBlankLines,
        tabToSpace,
        removeQuotes,
        customChars: customCharsTrimmed,
        mergeQuotedNewlines,
      };
      saveLastCleanCharsResult(stored);
      setLastResult(stored);
      setIsStaleResult(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRunning(false);
    }
  }, [
    inputFile,
    outputFile,
    hasAction,
    removeCr,
    mergeBlankLines,
    tabToSpace,
    removeQuotes,
    customCharsTrimmed,
    mergeQuotedNewlines,
    t,
    clearFeedback,
  ]);

  if (!isOpen) return null;

  const outputMissing = outputExists === false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-card border border-border/50 rounded-lg shadow-xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t.cleanChars}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea
          type="always"
          hideHorizontalScrollbar
          blockContent
          className="flex-1 min-h-0"
        >
          <div className="p-4 space-y-3">
            <div className="rounded-md bg-muted/40 p-2.5 space-y-1 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">{t.cleanCharsRule}</p>
              <p>
                {t.cleanCharsRuleDesc.replace("{file}", baseName(inputFile))}
              </p>
              <p className="font-mono text-foreground/80 break-all">
                {ruleSummary}
              </p>
            </div>

            <StepSection index={1} title={t.cleanCharsStepFile}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputFile}
                  onChange={(e) => {
                    clearFeedback();
                    outputTouchedRef.current = false;
                    setInputFile(e.target.value);
                  }}
                  placeholder={t.inputFile}
                  className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={browseInput}
                >
                  {t.open}
                </Button>
              </div>
              {inputFile.trim() !== "" && (
                <p className="text-[11px] leading-4 min-w-0 break-all">
                  {probeError ? (
                    <span className="text-danger break-all">
                      {t.probeFailed}: {probeError}
                    </span>
                  ) : probe ? (
                    <>
                      <span className="text-muted-foreground">
                        ✓ {t.firstRowColumns}:{" "}
                        <span className="text-foreground font-medium">
                          {probe.columns}
                        </span>
                      </span>
                      {headerPreview && (
                        <span className="text-muted-foreground/80 break-all">
                          {" "}
                          · {t.headerPreview}: {headerPreview}
                        </span>
                      )}
                    </>
                  ) : isProbing ? (
                    <span className="text-muted-foreground/70">
                      {t.probeLoading}
                    </span>
                  ) : null}
                </p>
              )}
            </StepSection>

            <StepSection
              index={2}
              title={t.cleanCharsStepOptions}
              aside={t.cleanCharsSelectedCount.replace(
                "{count}",
                String(selectedCount),
              )}
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <label className="flex items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={removeCr}
                    onChange={(e) => {
                      clearFeedback();
                      setRemoveCr(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    \r
                  </span>
                  {t.cleanCharsCharCR}
                  <span className="ml-auto text-[10px] text-muted-foreground/60">
                    {t.cleanCharsModeDelete}
                  </span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={mergeBlankLines}
                    onChange={(e) => {
                      clearFeedback();
                      setMergeBlankLines(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    ¶
                  </span>
                  {t.cleanCharsCharBlank}
                  <span className="ml-auto text-[10px] text-muted-foreground/60">
                    {t.cleanCharsModeMerge}
                  </span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={tabToSpace}
                    onChange={(e) => {
                      clearFeedback();
                      setTabToSpace(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    \t
                  </span>
                  {t.cleanCharsCharTab}
                  <span className="ml-auto text-[10px] text-muted-foreground/60">
                    {t.cleanCharsModeSpace}
                  </span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={removeQuotes}
                    onChange={(e) => {
                      clearFeedback();
                      setRemoveQuotes(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    "
                  </span>
                  {t.cleanCharsCharQuote}
                  <span className="ml-auto text-[10px] text-muted-foreground/60">
                    {t.cleanCharsModeDelete}
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground shrink-0">
                  {t.cleanCharsCustom}
                </label>
                <input
                  type="text"
                  value={customChars}
                  onChange={(e) => {
                    clearFeedback();
                    setCustomChars(e.target.value);
                  }}
                  placeholder={t.cleanCharsCustomPlaceholder}
                  className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
                />
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={mergeQuotedNewlines}
                    onChange={(e) => {
                      clearFeedback();
                      setMergeQuotedNewlines(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  {t.cleanCharsMergeQuotedNewlines}
                </label>
                <p className="text-[10.5px] leading-4 text-muted-foreground/80">
                  {t.cleanCharsMergeQuotedHint}
                </p>
              </div>
            </StepSection>

            <StepSection index={3} title={t.cleanCharsStepOutput}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={outputFile}
                  onChange={(e) => {
                    clearFeedback();
                    outputTouchedRef.current = true;
                    setOutputFile(e.target.value);
                  }}
                  placeholder={t.outputPathLeaveEmpty}
                  className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={browseOutput}
                >
                  {t.cleanCharsSaveAs}
                </Button>
              </div>
            </StepSection>

            <div className="rounded-lg border border-border/50 p-3">
              {lastResult ? (
                <div className="space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-success">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {isStaleResult ? t.lastResult : t.cleanCharsDone}
                    </span>
                    <span className="font-normal text-muted-foreground">
                      · {t.finishedAt}{" "}
                      {formatDateTime(new Date(lastResult.finishedAt))}
                      {formatElapsed(lastResult.elapsedMs) !== "" &&
                        ` · ${t.elapsed} ${formatElapsed(lastResult.elapsedMs)}`}
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <StatCell
                      label={t.cleanCharsRows}
                      value={String(lastResult.rows)}
                    />
                    <StatCell
                      label={t.cleanCharsRemoved}
                      value={String(lastResult.removedChars)}
                    />
                    <StatCell
                      label={t.cleanCharsReplaced}
                      value={String(lastResult.replacedChars)}
                    />
                  </div>
                  {(lastResult.unclosedLines ?? 0) > 0 && (
                    <p className="flex items-center gap-2 text-xs text-warning">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {t.cleanCharsUnclosedLines.replace(
                        "{count}",
                        String(lastResult.unclosedLines),
                      )}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/80 break-all">
                    {lastResult.outputPath}
                  </p>
                  {outputMissing && (
                    <p className="flex items-center gap-2 text-xs text-warning">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {t.lastResultNoOutput}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleOpenPath}
                      disabled={outputMissing}
                      title={outputMissing ? t.lastResultNoOutput : undefined}
                    >
                      {t.openPath}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleClearRecord}
                    >
                      {t.clearRecord}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.cleanCharsEmptyResult}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {error && (
          <div className="px-4 py-2 bg-danger-soft text-danger text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-muted/20 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {inputFile.trim() === ""
              ? t.cleanCharsReadyHint
              : !hasAction
                ? t.cleanCharsNoOptionSelected
                : t.cleanCharsReady.replace(
                    "{output}",
                    baseName(outputFile),
                  )}
          </span>
          <span className="flex items-center gap-3">
            <RunTimer running={isRunning} />
            <Button size="sm" onClick={handleRun} disabled={isRunning || !canRun}>
              {isRunning ? t.cleanCharsRunning : t.cleanCharsStart}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
