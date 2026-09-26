import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { useCsvProbe } from "@/hooks/useCsvProbe";
import { formatDateTime, formatElapsed } from "@/utils/format";
import {
  clearLastSeparateResult,
  delimiterLabel,
  loadLastSeparateResult,
  saveLastSeparateResult,
  type StoredSeparateResult,
} from "@/utils/separateHistory";
import type { ToastType } from "@/components/setting/Toast";

export interface SeparateResult {
  good_path: string;
  bad_path: string;
  good_rows: number;
  bad_rows: number;
  expected_columns: number;
  /** Backend-reported duration; optional for older payloads/mocks. */
  elapsed_ms?: number;
}

/** Sentinel value for the "detect it for me" delimiter mode. */
const AUTO_DELIMITER = "auto";

/** Mirrors the settings dialog's delimiter options. */
const DELIMITER_OPTIONS = [
  { label: "Comma (,)", value: "," },
  { label: "Semicolon (;)", value: ";" },
  { label: "Tab (\\t)", value: "\t" },
  { label: "Pipe (|)", value: "|" },
  { label: "Caret (^)", value: "^" },
];

/** Header fields shown in the preview line. */
const HEADER_PREVIEW_FIELDS = 8;

interface SeparateCSVDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
  defaultDelimiter?: string;
  onShowToast?: (message: string, type?: ToastType) => void;
  /** Notified after the user saves the detected delimiter as the app default. */
  onDefaultDelimiterChange?: (delimiter: string) => void;
}

export function SeparateCSVDialog({
  isOpen,
  onClose,
  initialInputFile,
  defaultDelimiter,
  onShowToast,
  onDefaultDelimiterChange,
}: SeparateCSVDialogProps) {
  const { t } = useLanguage();
  const appDefaultDelimiter = defaultDelimiter || ",";
  const [inputFile, setInputFile] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [delimiterMode, setDelimiterMode] = useState(AUTO_DELIMITER);
  const [quoting, setQuoting] = useState(true);
  const [noHeaders, setNoHeaders] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [expectedColumns, setExpectedColumns] = useState("");
  const [skiprows, setSkiprows] = useState("0");
  const [isSeparating, setIsSeparating] = useState(false);
  const [lastResult, setLastResult] = useState<StoredSeparateResult | null>(
    null,
  );
  const [isStaleResult, setIsStaleResult] = useState(false);
  const [outputExists, setOutputExists] = useState<{
    good: boolean;
    bad: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /** Only feedback is cleared on edit — the last result stays visible. */
  const clearFeedback = useCallback(() => {
    setError(null);
    setIsStaleResult(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const stored = loadLastSeparateResult();
      setInputFile(initialInputFile || stored?.inputFile || "");
      setOutputDir("");
      setDelimiterMode(AUTO_DELIMITER);
      setQuoting(true);
      setNoHeaders(false);
      setStreaming(false);
      setExpectedColumns("");
      setSkiprows("0");
      setLastResult(stored);
      setIsStaleResult(stored !== null);
      setError(null);
    }
  }, [isOpen, initialInputFile, defaultDelimiter]);

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

  const skiprowsValue = useMemo(() => {
    const trimmed = skiprows.trim();
    if (trimmed === "") return 0;
    const value = Number(trimmed);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }, [skiprows]);

  // File info: first row's column count + delimiter detection.
  const {
    probe,
    error: probeError,
    isProbing,
  } = useCsvProbe({
    inputFile,
    delimiter: delimiterMode === AUTO_DELIMITER ? null : delimiterMode,
    fallbackDelimiter: appDefaultDelimiter,
    skiprows: skiprowsValue,
    quoting,
    enabled: isOpen,
  });

  /** Delimiter the split will actually run with. */
  const effectiveDelimiter =
    delimiterMode !== AUTO_DELIMITER
      ? delimiterMode
      : probe?.delimiter || appDefaultDelimiter;

  // Flag a stored result whose output files were moved/deleted meanwhile.
  useEffect(() => {
    if (!isOpen || !lastResult) {
      setOutputExists(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [good, bad] = await Promise.all([
          invoke<boolean>("file_exists", { filePath: lastResult.goodPath }),
          invoke<boolean>("file_exists", { filePath: lastResult.badPath }),
        ]);
        if (!cancelled) setOutputExists({ good, bad });
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

  // "Save as the app-wide default" — replaces the trip to the settings page.
  const handleSaveAsDefault = useCallback(async () => {
    try {
      await invoke("set_default_delimiter", {
        delimiter: effectiveDelimiter,
      });
      onDefaultDelimiterChange?.(effectiveDelimiter);
      onShowToast?.(
        `${t.setAsDefaultDelimiter}: ${delimiterLabel(effectiveDelimiter)}`,
        "success",
      );
    } catch (err) {
      onShowToast?.(String(err), "error");
    }
  }, [
    effectiveDelimiter,
    onDefaultDelimiterChange,
    onShowToast,
    t.setAsDefaultDelimiter,
  ]);

  // Open the output location in the system file manager, selecting both files.
  const handleOpenPaths = useCallback(async () => {
    if (!lastResult) return;
    try {
      await invoke("reveal_paths", {
        paths: [lastResult.goodPath, lastResult.badPath],
      });
    } catch (err) {
      onShowToast?.(String(err), "error");
    }
  }, [lastResult, onShowToast]);

  const handleClearRecord = useCallback(() => {
    clearLastSeparateResult();
    setLastResult(null);
    setIsStaleResult(false);
  }, []);

  /** At least one output file is gone (or both) — worth warning the user. */
  const outputMissing =
    outputExists !== null && (!outputExists.good || !outputExists.bad);
  /** Revealing still works while one file survived: the backend skips the missing ones. */
  const canOpenPaths =
    outputExists === null || outputExists.good || outputExists.bad;

  const handleSeparate = useCallback(async () => {
    if (!inputFile.trim()) {
      setError(t.separateSelectFile);
      return;
    }
    let skip = 0;
    const trimmed = skiprows.trim();
    if (trimmed !== "") {
      skip = Number(trimmed);
      if (!Number.isInteger(skip) || skip < 0) {
        setError(`${t.skiprows}: invalid number`);
        return;
      }
    }
    clearFeedback();
    setIsSeparating(true);
    try {
      const data = await invoke<SeparateResult>("separate_csv", {
        path: inputFile,
        delimiter: effectiveDelimiter,
        quoting,
        expectedColumns:
          expectedColumns.trim() === "" ? null : expectedColumns.trim(),
        skiprows: skip,
        outDir: outputDir.trim() === "" ? null : outputDir.trim(),
        streaming,
        noHeaders,
      });
      const stored: StoredSeparateResult = {
        goodPath: data.good_path,
        badPath: data.bad_path,
        goodRows: data.good_rows,
        badRows: data.bad_rows,
        expectedColumns: data.expected_columns,
        finishedAt: new Date().toISOString(),
        elapsedMs: data.elapsed_ms,
        inputFile: inputFile.trim(),
        delimiter: effectiveDelimiter,
        quoting,
        noHeaders,
        skiprows: skip,
        streaming,
        expectedColumnsInput: expectedColumns.trim(),
      };
      saveLastSeparateResult(stored);
      setLastResult(stored);
      setIsStaleResult(false);
    } catch (err) {
      setError(String(err));
      if (!isOpen) {
        onShowToast?.(String(err), "error");
      }
    } finally {
      setIsSeparating(false);
    }
  }, [
    inputFile,
    outputDir,
    effectiveDelimiter,
    quoting,
    noHeaders,
    streaming,
    expectedColumns,
    skiprows,
    t,
    clearFeedback,
    isOpen,
    onShowToast,
  ]);

  const headerPreview = useMemo(() => {
    if (!probe) return "";
    const shown = probe.header
      .slice(0, HEADER_PREVIEW_FIELDS)
      .map((field) => field || "∅")
      .join(" | ");
    return probe.header.length > HEADER_PREVIEW_FIELDS ? `${shown} …` : shown;
  }, [probe]);

  const delimiterHint = useMemo(() => {
    if (!probe) return "";
    const label = delimiterLabel(probe.delimiter);
    if (probe.source === "forced") return label;
    if (probe.source === "fallback") {
      return `${t.detectFailed}「${label}」`;
    }
    const confidence =
      probe.confidence === "high"
        ? t.detectConfidenceHigh
        : t.detectConfidenceLow;
    return `${t.detectedDelimiter}「${label}」· ${probe.sampled_records} · ${confidence}`;
  }, [probe, t]);

  const isDelimiterLowConfidence =
    probe?.source === "detected" && probe.confidence !== "high";
  const showQuotingHint = probe !== null && !probe.quoting_used;
  const columnsMismatch =
    probe !== null &&
    expectedColumns.trim() !== "" &&
    Number(expectedColumns) !== probe.columns;

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
              {t.separateGoodBad}
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

          {/* File info: first row's column count + header preview */}
          {inputFile.trim() !== "" && (
            <div className="flex items-center gap-2 pl-1 text-[11px] leading-4">
              {probeError ? (
                <span className="text-red-600 truncate">
                  {t.probeFailed}: {probeError}
                </span>
              ) : probe ? (
                <>
                  <span className="text-muted-foreground shrink-0">
                    ✓ {t.firstRowColumns}:{" "}
                    <span className="text-foreground font-medium">
                      {probe.columns}
                    </span>
                  </span>
                  {headerPreview && (
                    <span className="text-muted-foreground/80 truncate min-w-0">
                      · {t.headerPreview}: {headerPreview}
                    </span>
                  )}
                </>
              ) : isProbing ? (
                <span className="text-muted-foreground/70">
                  {t.probeLoading}
                </span>
              ) : null}
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t.delimiter}
            </label>
            <div className="w-40 shrink-0">
              <Select
                value={delimiterMode}
                onChange={(value) => {
                  clearFeedback();
                  setDelimiterMode(value);
                }}
                options={[
                  { label: t.delimiterAuto, value: AUTO_DELIMITER },
                  ...DELIMITER_OPTIONS,
                ]}
              />
            </div>
            <span
              className={`truncate min-w-0 flex-1 text-[11px] ${
                isDelimiterLowConfidence || showQuotingHint
                  ? "text-amber-600"
                  : "text-muted-foreground/80"
              }`}
            >
              {delimiterHint}
            </span>
            <button
              type="button"
              className="text-[11px] text-primary hover:underline shrink-0 disabled:text-muted-foreground/40 disabled:no-underline"
              onClick={handleSaveAsDefault}
              disabled={effectiveDelimiter === appDefaultDelimiter}
            >
              {t.setAsDefaultDelimiter}
            </button>
          </div>

          {showQuotingHint && (
            <p className="pl-1 text-[11px] text-amber-600">
              {t.detectQuotingHint}
            </p>
          )}

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
              placeholder={t.inputFile}
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
              title={t.expectedColumnsHint}
            >
              {t.expectedColumns}
            </label>
            <input
              type="text"
              value={expectedColumns}
              onChange={(e) => {
                clearFeedback();
                setExpectedColumns(e.target.value);
              }}
              placeholder={
                probe
                  ? `${t.expectedColumnsHint} · ${probe.columns}`
                  : t.expectedColumnsHint
              }
              className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
            />
            {columnsMismatch && (
              <span
                className="text-[11px] text-amber-600 shrink-0"
                title={t.expectedColumnsHint}
              >
                {t.expectedColumns} {expectedColumns} ≠ {probe?.columns}
              </span>
            )}
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t.skiprows}
            </label>
            <input
              type="number"
              min={0}
              value={skiprows}
              onChange={(e) => {
                clearFeedback();
                setSkiprows(e.target.value);
              }}
              className="w-20 h-8 px-2 text-xs border rounded-md bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <input
                type="checkbox"
                checked={quoting}
                onChange={(e) => {
                  clearFeedback();
                  setQuoting(e.target.checked);
                }}
                className="accent-primary"
              />
              {t.quoting}
            </label>
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
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <input
                type="checkbox"
                checked={streaming}
                onChange={(e) => {
                  clearFeedback();
                  setStreaming(e.target.checked);
                }}
                className="accent-primary"
              />
              {t.streaming}
            </label>
            <div className="flex-1" />
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={handleSeparate}
              disabled={isSeparating}
            >
              {isSeparating ? t.separating : t.separateStart}
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
                      {isStaleResult ? t.lastResult : t.separateCompleteNow}
                    </span>
                    <span className="font-normal text-muted-foreground">
                      · {t.finishedAt}{" "}
                      {formatDateTime(new Date(lastResult.finishedAt))}
                      {formatElapsed(lastResult.elapsedMs) !== "" &&
                        ` · ${t.elapsed} ${formatElapsed(lastResult.elapsedMs)}`}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.goodRows}: {lastResult.goodRows} · {t.badRows}:{" "}
                    {lastResult.badRows} · {t.expectedColumns}:{" "}
                    {lastResult.expectedColumns} · {t.delimiter}:{" "}
                    {delimiterLabel(lastResult.delimiter)}
                    {lastResult.noHeaders ? ` · ${t.noHeaders}` : ""}
                    {lastResult.streaming ? ` · ${t.streaming}` : ""}
                  </p>
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground/80 break-all">
                      {lastResult.goodPath}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground/80 break-all">
                      {lastResult.badPath}
                    </p>
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
                  {t.separateNoResult}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
