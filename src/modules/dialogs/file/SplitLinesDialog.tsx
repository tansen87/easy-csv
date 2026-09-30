import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n";
import { formatDateTime, formatElapsed } from "@/utils/format";
import {
  clearLastSplitLinesResult,
  loadLastSplitLinesResult,
  saveLastSplitLinesResult,
  type StoredSplitLinesResult,
} from "@/utils/splitLinesHistory";
import type { ToastType } from "@/components/setting/Toast";

export interface SplitLinesResult {
  output_dir: string;
  output_paths: string[];
  file_count: number;
  lines_per_file: number;
  total_rows: number;
  header_written: boolean;
  /** Backend-reported duration; optional for older payloads/mocks. */
  elapsed_ms?: number;
}

/** Rows per part used when there is no previous run to remember. */
const DEFAULT_LINES_PER_FILE = 1_000_000;

/** Quick row-count presets offered next to the number field. */
const ROWS_PRESETS = [1_000, 10_000, 100_000, 1_000_000];

/** How many part paths the result panel lists at most (`fileCount` carries the
 * full count; the cap also keeps the persisted record small). */
const MAX_SAMPLE_PATHS = 3;

/** Placeholder file used by the output preview before one is picked. */
const EXAMPLE_FILE = "app.log";

function formatRows(value: number): string {
  return value.toLocaleString("en-US");
}

/** `{stem, ext}` of a path, so the preview can show the real `_partN` names. */
function splitFileName(path: string): { stem: string; ext: string } {
  const base = path.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return { stem: base, ext: "" };
  return { stem: base.slice(0, dot), ext: base.slice(dot) };
}

/** Numbered step card — same skeleton as MergeExcelDialog's ①②③ sections. */
function StepSection({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/50 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
          {index}
        </span>
        <span className="text-[13px] font-medium text-foreground">{title}</span>
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
      >
        {value}
      </p>
    </div>
  );
}

interface SplitLinesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
  onShowToast?: (message: string, type?: ToastType) => void;
}

export function SplitLinesDialog({
  isOpen,
  onClose,
  initialInputFile,
  onShowToast,
}: SplitLinesDialogProps) {
  const { t } = useLanguage();
  const [inputFile, setInputFile] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [linesPerFile, setLinesPerFile] = useState(
    String(DEFAULT_LINES_PER_FILE),
  );
  const [noHeaders, setNoHeaders] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [lastResult, setLastResult] = useState<StoredSplitLinesResult | null>(
    null,
  );
  const [isStaleResult, setIsStaleResult] = useState(false);
  const [outputDirExists, setOutputDirExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /** Only feedback is cleared on edit — the last result stays visible. */
  const clearFeedback = useCallback(() => {
    setError(null);
    setIsStaleResult(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const stored = loadLastSplitLinesResult();
      // Back-fill the options too (design 020 precedent): splitting with the
      // same row count is a repeat operation, so "pick a file and go" works.
      setInputFile(initialInputFile || stored?.inputFile || "");
      setOutputDir(stored?.outDirInput ?? "");
      setLinesPerFile(String(stored?.linesPerFile ?? DEFAULT_LINES_PER_FILE));
      setNoHeaders(stored?.noHeaders ?? false);
      setLastResult(stored);
      setIsStaleResult(stored !== null);
      setError(null);
    }
  }, [isOpen, initialInputFile]);

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

  /** `null` while the field is empty or not a positive integer. */
  const linesPerFileValue = useMemo(() => {
    const trimmed = linesPerFile.trim();
    if (trimmed === "") return null;
    const value = Number(trimmed);
    return Number.isInteger(value) && value >= 1 ? value : null;
  }, [linesPerFile]);

  /** Whatever the row field currently holds, for the preview and status line. */
  const rowsLabel =
    linesPerFileValue !== null
      ? formatRows(linesPerFileValue)
      : linesPerFile.trim() || "—";

  /** `app.log` → `app_part1.log …`, derived from the picked file when there is
   * one so the naming rule is concrete instead of abstract. */
  const exampleParts = useMemo(() => {
    const path = inputFile.trim();
    const { stem, ext } = path
      ? splitFileName(path)
      : splitFileName(EXAMPLE_FILE);
    return [1, 2, 3].map((n) => `${stem}_part${n}${ext}`);
  }, [inputFile]);

  const exampleFileName = inputFile.trim().split(/[\\/]/).pop() || EXAMPLE_FILE;

  // Flag a stored result whose output directory was moved/deleted meanwhile.
  useEffect(() => {
    if (!isOpen || !lastResult) {
      setOutputDirExists(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const exists = await invoke<boolean>("file_exists", {
          filePath: lastResult.outputDir,
        });
        if (!cancelled) setOutputDirExists(exists);
      } catch {
        if (!cancelled) setOutputDirExists(null);
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
        { name: "Text", extensions: ["csv", "txt", "tsv", "log"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (file) {
      clearFeedback();
      setInputFile(file);
    }
  }, [clearFeedback]);

  const browseOutputDir = useCallback(async () => {
    const dir = await open({ multiple: false, directory: true });
    if (dir) {
      clearFeedback();
      setOutputDir(dir);
    }
  }, [clearFeedback]);

  // Open the output directory (one path, whatever the part count).
  const handleOpenPaths = useCallback(async () => {
    if (!lastResult) return;
    try {
      await invoke("reveal_paths", { paths: [lastResult.outputDir] });
    } catch (err) {
      onShowToast?.(String(err), "error");
    }
  }, [lastResult, onShowToast]);

  const handleClearRecord = useCallback(() => {
    clearLastSplitLinesResult();
    setLastResult(null);
    setIsStaleResult(false);
  }, []);

  const handleSplit = useCallback(async () => {
    if (!inputFile.trim()) {
      setError(t.separateSelectFile);
      return;
    }
    if (linesPerFileValue === null) {
      setError(t.splitLinesInvalidLinesPerFile);
      return;
    }
    clearFeedback();
    setIsSplitting(true);
    try {
      const data = await invoke<SplitLinesResult>("split_lines", {
        path: inputFile,
        linesPerFile: linesPerFileValue,
        outDir: outputDir.trim() === "" ? null : outputDir.trim(),
        noHeaders,
      });
      const stored: StoredSplitLinesResult = {
        outputDir: data.output_dir,
        samplePaths: data.output_paths.slice(0, MAX_SAMPLE_PATHS),
        fileCount: data.file_count,
        totalRows: data.total_rows,
        headerWritten: data.header_written,
        finishedAt: new Date().toISOString(),
        elapsedMs: data.elapsed_ms,
        inputFile: inputFile.trim(),
        outDirInput: outputDir.trim(),
        linesPerFile: data.lines_per_file,
        noHeaders,
      };
      saveLastSplitLinesResult(stored);
      setLastResult(stored);
      setIsStaleResult(false);
    } catch (err) {
      setError(String(err));
      if (!isOpen) {
        onShowToast?.(String(err), "error");
      }
    } finally {
      setIsSplitting(false);
    }
  }, [
    inputFile,
    outputDir,
    linesPerFileValue,
    noHeaders,
    t,
    clearFeedback,
    isOpen,
    onShowToast,
  ]);

  /** One directory is all we need to point at, so the state is binary. */
  const outputMissing = outputDirExists === false;
  const canOpenPaths = outputDirExists !== false;

  if (!isOpen) return null;

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
              {t.splitLines}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea type="always" className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {/* ── 输出示例:一眼看懂会产出什么 ───────────────── */}
            <div className="rounded-md bg-muted/40 p-2.5 space-y-1 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">
                {t.splitLinesExampleTitle}
              </p>
              <p>
                {t.splitLinesExampleInput
                  .replace("{file}", exampleFileName)
                  .replace("{rows}", rowsLabel)}
              </p>
              <div className="space-y-0.5">
                {exampleParts.map((name, index) => (
                  <p
                    key={name}
                    className="font-mono text-foreground/80 break-all"
                  >
                    {name}
                    {index === exampleParts.length - 1 ? " …" : ""}
                  </p>
                ))}
              </div>
              <p>{t.splitLinesExampleNote}</p>
            </div>

            {/* 选择要拆分的文件 */}
            <StepSection index={1} title={t.splitLinesStepFile}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputFile}
                  onChange={(e) => {
                    clearFeedback();
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
            </StepSection>

            {/* 拆分设置 */}
            <StepSection index={2} title={t.splitLinesStepSettings}>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="split-lines-rows"
                  className="text-xs font-medium text-muted-foreground shrink-0"
                >
                  {t.linesPerFile}
                </label>
                <input
                  id="split-lines-rows"
                  type="number"
                  min={1}
                  value={linesPerFile}
                  onChange={(e) => {
                    clearFeedback();
                    setLinesPerFile(e.target.value);
                  }}
                  placeholder={t.linesPerFileHint}
                  className="w-28 h-8 px-2 text-xs border rounded-md bg-background"
                />
                <div className="flex items-center gap-1 ml-auto">
                  {ROWS_PRESETS.map((preset) => {
                    const active = linesPerFileValue === preset;
                    return (
                      <button
                        key={preset}
                        onClick={() => {
                          clearFeedback();
                          setLinesPerFile(String(preset));
                        }}
                        aria-label={`${t.linesPerFile} ${formatRows(preset)}`}
                        aria-pressed={active}
                        className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {formatRows(preset)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <input
                    type="checkbox"
                    checked={noHeaders}
                    onChange={(e) => {
                      clearFeedback();
                      setNoHeaders(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  {t.noHeaders}
                </label>
                <span className="text-[11px] text-muted-foreground/70">
                  {t.splitLinesNoHeadersHint}
                </span>
              </div>
            </StepSection>

            {/* 输出位置 */}
            <StepSection index={3} title={t.splitLinesStepOutput}>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground shrink-0">
                  {t.outputDir}
                </label>
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => {
                    clearFeedback();
                    setOutputDir(e.target.value);
                  }}
                  placeholder={t.outputPathLeaveEmpty}
                  className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={browseOutputDir}
                >
                  {t.open}
                </Button>
              </div>
            </StepSection>

            {/* 结果卡 */}
            <div className="rounded-lg border border-border/50 p-3">
              {lastResult ? (
                <div className="space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-green-600">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {isStaleResult
                        ? t.splitLinesLastResult
                        : t.separateCompleteNow}
                    </span>
                    <span className="font-normal text-muted-foreground">
                      · {t.finishedAt}{" "}
                      {formatDateTime(new Date(lastResult.finishedAt))}
                      {formatElapsed(lastResult.elapsedMs) !== "" &&
                        ` · ${t.elapsed} ${formatElapsed(lastResult.elapsedMs)}`}
                    </span>
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <StatCell
                      label={t.splitLinesFileCount}
                      value={String(lastResult.fileCount)}
                    />
                    <StatCell
                      label={t.splitLinesTotalRows}
                      value={String(lastResult.totalRows)}
                    />
                    <StatCell
                      label={t.linesPerFile}
                      value={String(lastResult.linesPerFile)}
                    />
                    <StatCell
                      label={
                        lastResult.headerWritten
                          ? t.splitLinesHeaderCopied
                          : t.noHeaders
                      }
                      value={lastResult.headerWritten ? "✓" : "—"}
                    />
                  </div>
                  {/* Bounded scroll box: a long output directory or long part
                      names wrap, and the card must not stretch the dialog. */}
                  <ScrollArea
                    type="always"
                    className="h-24 rounded-md border border-border/50"
                  >
                    <div className="p-2 space-y-1">
                      <p className="text-xs text-muted-foreground/80 break-all">
                        {lastResult.outputDir}
                      </p>
                      {lastResult.samplePaths.map((path) => (
                        <p
                          key={path}
                          className="text-xs text-muted-foreground/60 break-all"
                        >
                          {path}
                        </p>
                      ))}
                    </div>
                  </ScrollArea>
                  {outputMissing && (
                    <p className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {t.lastResultNoOutput}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleOpenPaths}
                      disabled={!canOpenPaths}
                      title={canOpenPaths ? undefined : t.lastResultNoOutput}
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
                  {t.splitLinesNoResult}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {error && (
          <div className="px-4 py-2 bg-red-500/10 text-red-600 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {/* footer: current setting + primary action */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-muted/20 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {t.splitLinesReady.replace("{rows}", rowsLabel)}
          </span>
          <Button size="sm" onClick={handleSplit} disabled={isSplitting}>
            {isSplitting ? t.splitting : t.splitLinesStart}
          </Button>
        </div>
      </div>
    </div>
  );
}
