import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  clearLastCsvToExcelResult,
  loadLastCsvToExcelResult,
  saveLastCsvToExcelResult,
  type StoredCsvToExcelResult,
} from "@/utils/csvToExcelHistory";
import type { ToastType } from "@/components/setting/Toast";

/** Mirrors `CsvToXlsxResult` in `src-tauri/src/csv_excel.rs`. */
export interface CsvToXlsxResult {
  output_path: string;
  sheet_count: number;
  total_rows: number;
  columns: number;
  multi: boolean;
  chunk_size: number;
  delimiter: string;
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

/** Rows per worksheet when split mode is on. */
const DEFAULT_CHUNK_SIZE = 100_000;

/** Header fields shown in the preview line. */
const HEADER_PREVIEW_FIELDS = 8;

/** Placeholder file used by the output preview before one is picked. */
const EXAMPLE_FILE = "orders.csv";

function formatRows(value: number): string {
  return value.toLocaleString("en-US");
}

/** `{stem, ext}` of a path, so the preview can show the real output name. */
function splitFileName(path: string): { stem: string; ext: string } {
  const base = path.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return { stem: base, ext: "" };
  return { stem: base.slice(0, dot), ext: base.slice(dot) };
}

/** Numbered step card — same skeleton as SplitLinesDialog / SeparateCSVDialog. */
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
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

interface CsvToExcelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
  defaultDelimiter?: string;
  onShowToast?: (message: string, type?: ToastType) => void;
}

export function CsvToExcelDialog({
  isOpen,
  onClose,
  initialInputFile,
  defaultDelimiter,
  onShowToast,
}: CsvToExcelDialogProps) {
  const { t } = useLanguage();
  const appDefaultDelimiter = defaultDelimiter || ",";
  const [inputFile, setInputFile] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [delimiterMode, setDelimiterMode] = useState(AUTO_DELIMITER);
  /**
   * The checkbox is labelled "ignore quoting", while the backend flag is its
   * inverse. Quote parsing stays on by default: a quoted cell must not be
   * split on the delimiter.
   */
  const [ignoreQuoting, setIgnoreQuoting] = useState(false);
  /** Strict by default: a ragged row stops the run instead of shifting cells. */
  const [flexible, setFlexible] = useState(false);
  const [skiprows, setSkiprows] = useState("0");
  const [multi, setMulti] = useState(false);
  const [chunkSize, setChunkSize] = useState(String(DEFAULT_CHUNK_SIZE));
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<StoredCsvToExcelResult | null>(
    null,
  );
  const [isStaleResult, setIsStaleResult] = useState(false);
  const [outputExists, setOutputExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /** Only feedback is cleared on edit — the last result stays visible. */
  const clearFeedback = useCallback(() => {
    setError(null);
    setIsStaleResult(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const stored = loadLastCsvToExcelResult();
      setInputFile(initialInputFile || stored?.inputFile || "");
      setOutputDir(stored?.outDirInput ?? "");
      setDelimiterMode(stored?.delimiterMode ?? AUTO_DELIMITER);
      setIgnoreQuoting(stored?.ignoreQuoting ?? false);
      setFlexible(stored?.flexible ?? false);
      setSkiprows(String(stored?.skiprows ?? 0));
      setMulti(stored?.multi ?? false);
      setChunkSize(String(stored?.chunkSize ?? DEFAULT_CHUNK_SIZE));
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

  const skiprowsValue = useMemo(() => {
    const trimmed = skiprows.trim();
    if (trimmed === "") return 0;
    const value = Number(trimmed);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }, [skiprows]);

  const chunkSizeValue = useMemo(() => {
    const value = Number(chunkSize.trim());
    return Number.isInteger(value) && value > 0 ? value : 0;
  }, [chunkSize]);

  // File info: header columns + the delimiter the run will use.
  const {
    probe,
    error: probeError,
    isProbing,
  } = useCsvProbe({
    inputFile,
    delimiter: delimiterMode === AUTO_DELIMITER ? null : delimiterMode,
    fallbackDelimiter: appDefaultDelimiter,
    skiprows: skiprowsValue,
    quoting: !ignoreQuoting,
    enabled: isOpen,
  });

  /** Delimiter the conversion will actually run with. */
  const effectiveDelimiter =
    delimiterMode !== AUTO_DELIMITER
      ? delimiterMode
      : probe?.delimiter || appDefaultDelimiter;

  const headerPreview = useMemo(() => {
    if (!probe) return "";
    const shown = probe.header
      .slice(0, HEADER_PREVIEW_FIELDS)
      .map((field) => field || "∅")
      .join(" | ");
    return probe.header.length > HEADER_PREVIEW_FIELDS ? `${shown} …` : shown;
  }, [probe]);

  /** Concrete `{stem}.xlsx` the output preview names. */
  const outputPreview = useMemo(() => {
    const path = inputFile.trim();
    const { stem } = splitFileName(path === "" ? EXAMPLE_FILE : path);
    return {
      file: path === "" ? EXAMPLE_FILE : (path.split(/[\\/]/).pop() ?? path),
      name: `${stem}.xlsx`,
    };
  }, [inputFile]);

  // Flag a stored result whose output file was moved/deleted meanwhile.
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

  const handleOpenPath = useCallback(async () => {
    if (!lastResult) return;
    try {
      await invoke("reveal_paths", { paths: [lastResult.outputPath] });
    } catch (err) {
      onShowToast?.(String(err), "error");
    }
  }, [lastResult, onShowToast]);

  const handleClearRecord = useCallback(() => {
    clearLastCsvToExcelResult();
    setLastResult(null);
    setIsStaleResult(false);
  }, []);

  const handleRun = useCallback(async () => {
    if (!inputFile.trim()) {
      setError(t.excelSelectFile);
      return;
    }
    if (multi && chunkSizeValue === 0) {
      setError(t.excelChunkSizeError);
      return;
    }
    clearFeedback();
    setIsRunning(true);
    try {
      const data = await invoke<CsvToXlsxResult>("csv_to_xlsx", {
        path: inputFile,
        multi,
        chunkSize: chunkSizeValue,
        skiprows: skiprowsValue,
        quoting: !ignoreQuoting,
        flexible,
        delimiter: effectiveDelimiter,
        outDir: outputDir.trim() === "" ? null : outputDir.trim(),
      });
      const stored: StoredCsvToExcelResult = {
        outputPath: data.output_path,
        totalRows: data.total_rows,
        sheetCount: data.sheet_count,
        columns: data.columns,
        multi: data.multi,
        chunkSize: data.chunk_size,
        finishedAt: new Date().toISOString(),
        elapsedMs: data.elapsed_ms,
        inputFile: inputFile.trim(),
        outDirInput: outputDir.trim(),
        delimiterMode,
        ignoreQuoting,
        flexible,
        skiprows: skiprowsValue,
      };
      saveLastCsvToExcelResult(stored);
      setLastResult(stored);
      setIsStaleResult(false);
    } catch (err) {
      setError(String(err));
      if (!isOpen) {
        onShowToast?.(String(err), "error");
      }
    } finally {
      setIsRunning(false);
    }
  }, [
    inputFile,
    outputDir,
    multi,
    chunkSizeValue,
    skiprowsValue,
    ignoreQuoting,
    flexible,
    effectiveDelimiter,
    delimiterMode,
    t,
    clearFeedback,
    isOpen,
    onShowToast,
  ]);

  const outputMissing = outputExists === false;

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
              {t.csvToExcel}
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
            {/* Output Example */}
            <div className="rounded-md bg-muted/40 p-2.5 space-y-1 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">
                {t.excelExampleTitle}
              </p>
              <p>
                {t.excelExampleInput
                  .replace("{file}", outputPreview.file)
                  .replace(
                    "{mode}",
                    multi ? t.excelModeMulti : t.excelModeSingle,
                  )}
              </p>
              <p className="font-mono text-foreground/80 break-all">
                {outputPreview.name}
              </p>
              <p>{t.excelExampleNote}</p>
            </div>

            {/* Select the CSV file */}
            <StepSection index={1} title={t.excelStepFile}>
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
              {inputFile.trim() !== "" && (
                <p className="text-[11px] leading-4 min-w-0 break-all">
                  {probeError ? (
                    <span className="text-red-600 break-all">
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

            {/* Conversion settings */}
            <StepSection index={2} title={t.excelStepSettings}>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground shrink-0">
                  {t.excelMode}
                </label>
                <div className="w-44 shrink-0">
                  <Select
                    value={multi ? "multi" : "single"}
                    onChange={(value) => {
                      clearFeedback();
                      setMulti(value === "multi");
                    }}
                    options={[
                      { label: t.excelModeSingle, value: "single" },
                      { label: t.excelModeMulti, value: "multi" },
                    ]}
                    ariaLabel={t.excelMode}
                  />
                </div>
                {multi && (
                  <>
                    <label
                      htmlFor="csv-to-excel-chunk"
                      className="text-xs font-medium text-muted-foreground shrink-0 ml-auto"
                    >
                      {t.excelChunkSize}
                    </label>
                    <input
                      id="csv-to-excel-chunk"
                      type="number"
                      min={1}
                      value={chunkSize}
                      onChange={(e) => {
                        clearFeedback();
                        setChunkSize(e.target.value);
                      }}
                      className="w-36 h-8 px-2 text-xs border rounded-md bg-background"
                    />
                  </>
                )}
              </div>
              {multi && (
                <p className="text-[11px] text-muted-foreground/70">
                  {t.excelChunkSizeHint}
                </p>
              )}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground shrink-0">
                  {t.delimiter}
                </label>
                <div className="w-44 shrink-0">
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
                    ariaLabel={t.delimiter}
                  />
                </div>
                <label
                  htmlFor="csv-to-excel-skiprows"
                  className="text-xs font-medium text-muted-foreground shrink-0 ml-auto"
                >
                  {t.skiprows}
                </label>
                <input
                  id="csv-to-excel-skiprows"
                  type="number"
                  min={0}
                  value={skiprows}
                  onChange={(e) => {
                    clearFeedback();
                    setSkiprows(e.target.value);
                  }}
                  className="w-36 h-8 px-2 text-xs border rounded-md bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <input
                    type="checkbox"
                    checked={ignoreQuoting}
                    onChange={(e) => {
                      clearFeedback();
                      setIgnoreQuoting(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  {t.quoting}
                </label>
                <span className="text-[11px] text-muted-foreground/70">
                  {t.separateQuotingHint}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <input
                    type="checkbox"
                    checked={flexible}
                    onChange={(e) => {
                      clearFeedback();
                      setFlexible(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  {t.groupEnumFlexible}
                </label>
                <span className="text-[11px] text-muted-foreground/70">
                  {t.groupEnumFlexibleHint}
                </span>
              </div>
            </StepSection>

            {/* Output location */}
            <StepSection index={3} title={t.excelStepOutput}>
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

            {/* Result card */}
            <div className="rounded-lg border border-border/50 p-3">
              {lastResult ? (
                <div className="space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-green-600">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {isStaleResult
                        ? t.excelLastResult
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
                      label={t.excelRows}
                      value={formatRows(lastResult.totalRows)}
                    />
                    <StatCell
                      label={t.excelSheets}
                      value={formatRows(lastResult.sheetCount)}
                    />
                    <StatCell
                      label={t.excelColumns}
                      value={formatRows(lastResult.columns)}
                    />
                    <StatCell
                      label={t.excelMode}
                      value={
                        lastResult.multi ? t.excelModeMulti : t.excelModeSingle
                      }
                    />
                  </div>
                  <ScrollArea
                    type="always"
                    hideHorizontalScrollbar
                    blockContent
                    className="h-20 rounded-md border border-border/50"
                  >
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground/80 break-all">
                        {lastResult.outputPath}
                      </p>
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
                  {t.excelNoResult}
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
            {inputFile.trim() === ""
              ? t.excelReadyHint
              : t.excelReady.replace(
                  "{sheets}",
                  multi ? `${formatRows(chunkSizeValue)} × N` : "1",
                )}
          </span>
          <Button size="sm" onClick={handleRun} disabled={isRunning}>
            {isRunning ? t.excelRunning : t.excelStart}
          </Button>
        </div>
      </div>
    </div>
  );
}
