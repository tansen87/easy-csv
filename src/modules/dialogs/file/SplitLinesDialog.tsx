import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const DEFAULT_LINES_PER_FILE = 100000;

/** How many part paths the result panel lists (`fileCount` carries the rest). */
const MAX_SAMPLE_PATHS = 5;

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
        className="relative bg-card border border-border/50 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] min-h-[400px] flex flex-col overflow-hidden outline-none"
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

        <div className="px-4 py-3 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t.inputFile}
            </label>
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

          <div className="flex items-center gap-2">
            <label
              className="text-xs font-medium text-muted-foreground shrink-0"
              title={t.linesPerFileHint}
            >
              {t.linesPerFile}
            </label>
            <input
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
            <span className="truncate min-w-0 flex-1 text-[11px] text-muted-foreground/80">
              {t.linesPerFileHint}
            </span>
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
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 ml-auto"
              onClick={handleSplit}
              disabled={isSplitting}
            >
              {isSplitting ? t.splitting : t.splitLinesStart}
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-500/10 text-red-600 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <div className="rounded border border-border/50 p-4">
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
                  <p className="text-xs text-muted-foreground">
                    {t.splitLinesFileCount}: {lastResult.fileCount} ·{" "}
                    {t.splitLinesTotalRows}: {lastResult.totalRows} ·{" "}
                    {t.linesPerFile}: {lastResult.linesPerFile}
                    {lastResult.headerWritten
                      ? ` · ${t.splitLinesHeaderCopied}`
                      : ` · ${t.noHeaders}`}
                  </p>
                  <div className="space-y-1.5">
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
                  {outputMissing && (
                    <p className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {t.lastResultNoOutput}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}
