import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { formatDateTime, formatElapsed } from "@/utils/format";
import {
  clearLastExcelMergeResult,
  loadLastExcelMergeResult,
  saveLastExcelMergeResult,
  type ExcelAlign,
  type ExcelMissingSheet,
  type ExcelOutputFormat,
  type ExcelSheetMode,
  type ExcelSourceColumn,
  type StoredExcelMergeResult,
} from "@/utils/excelMergeHistory";
import type { ToastType } from "@/components/setting/Toast";

// -- backend payloads (snake_case, mirroring the Rust structs) ----------------

export interface ExcelSourceFile {
  path: string;
  sheets: string[];
  ok: boolean;
  error: string | null;
}

export interface ExcelScanResult {
  files: ExcelSourceFile[];
  file_count: number;
  sheet_names: string[];
  warnings: string[];
}

export interface ExcelMergeResult {
  output_path: string;
  output_format: "csv" | "xlsx";
  source_file_count: number;
  sheet_count: number;
  total_rows: number;
  header: string[];
  skipped: string[];
  warnings: string[];
  union_summary: {
    final_columns: string[];
    not_in_all_parts: { column: string; present_in: number; total: number }[];
    near_duplicate_columns: [string, string][];
  } | null;
  /** Backend-reported duration; optional for older payloads/mocks. */
  elapsed_ms?: number;
}

// -- constants ----------------------------------------------------------------

/** Extension checkboxes, in display order (design 025 §3.7). */
const EXTENSION_OPTIONS = ["xlsx", "xls", "xlsb", "ods"] as const;

const DEFAULT_EXTENSIONS = ["xlsx"];

const SHEET_MODE_CARDS: {
  value: ExcelSheetMode;
  labelKey:
    | "mergeExcelSheetFirst"
    | "mergeExcelSheetByName"
    | "mergeExcelSheetAll";
  subKey:
    | "mergeExcelSheetFirstSub"
    | "mergeExcelSheetNameSub"
    | "mergeExcelSheetAllSub";
}[] = [
  {
    value: "first",
    labelKey: "mergeExcelSheetFirst",
    subKey: "mergeExcelSheetFirstSub",
  },
  {
    value: "all",
    labelKey: "mergeExcelSheetAll",
    subKey: "mergeExcelSheetAllSub",
  },
  {
    value: "name",
    labelKey: "mergeExcelSheetByName",
    subKey: "mergeExcelSheetNameSub",
  },
];

const ALIGN_OPTIONS: {
  value: ExcelAlign;
  labelKey:
    | "mergeExcelAlignUnion"
    | "mergeExcelAlignStrict"
    | "mergeExcelAlignIntersection";
  hintKey:
    | "mergeExcelAlignHintUnion"
    | "mergeExcelAlignHintStrict"
    | "mergeExcelAlignHintIntersection";
}[] = [
  {
    value: "union",
    labelKey: "mergeExcelAlignUnion",
    hintKey: "mergeExcelAlignHintUnion",
  },
  {
    value: "strict",
    labelKey: "mergeExcelAlignStrict",
    hintKey: "mergeExcelAlignHintStrict",
  },
  {
    value: "intersection",
    labelKey: "mergeExcelAlignIntersection",
    hintKey: "mergeExcelAlignHintIntersection",
  },
];

const SOURCE_COLUMN_OPTIONS: {
  value: ExcelSourceColumn;
  labelKey:
    | "mergeExcelSourceNone"
    | "mergeExcelSourceFile"
    | "mergeExcelSourceFileSheet";
}[] = [
  { value: "none", labelKey: "mergeExcelSourceNone" },
  { value: "file", labelKey: "mergeExcelSourceFile" },
  { value: "file_sheet", labelKey: "mergeExcelSourceFileSheet" },
];

const MISSING_SHEET_OPTIONS: {
  value: ExcelMissingSheet;
  labelKey: "mergeExcelMissingError" | "mergeExcelMissingSkip";
}[] = [
  { value: "error", labelKey: "mergeExcelMissingError" },
  { value: "skip", labelKey: "mergeExcelMissingSkip" },
];

const OUTPUT_FORMAT_OPTIONS: {
  value: ExcelOutputFormat;
  label: string;
}[] = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "XLSX" },
];

type ScanStatus = "idle" | "scanning" | "done" | "error";

interface MergeExcelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
  onShowToast?: (message: string, type?: ToastType) => void;
}

export function MergeExcelDialog({
  isOpen,
  onClose,
  initialInputFile,
  onShowToast,
}: MergeExcelDialogProps) {
  const { t } = useLanguage();
  const [sources, setSources] = useState<string[]>([]);
  const [recursive, setRecursive] = useState(false);
  const [extensions, setExtensions] = useState<string[]>([
    ...DEFAULT_EXTENSIONS,
  ]);
  const [sheetMode, setSheetMode] = useState<ExcelSheetMode>("first");
  const [sheetName, setSheetName] = useState("");
  const [missingSheet, setMissingSheet] = useState<ExcelMissingSheet>("error");
  const [align, setAlign] = useState<ExcelAlign>("union");
  const [sourceColumn, setSourceColumn] = useState<ExcelSourceColumn>(
    "file_sheet",
  );
  const [sourceColumnName, setSourceColumnName] = useState("source");
  const [outputPathInput, setOutputPathInput] = useState("");
  const [outputFormat, setOutputFormat] = useState<ExcelOutputFormat>("xlsx");

  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanResult, setScanResult] = useState<ExcelScanResult | null>(null);
  /** Workbooks the user removed in the preview (excluded from the merge). */
  const [excluded, setExcluded] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [isMerging, setIsMerging] = useState(false);
  const [lastResult, setLastResult] = useState<StoredExcelMergeResult | null>(
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

  // Invalidate the scan whenever the discovery options change.
  useEffect(() => {
    setScanResult(null);
    setScanStatus("idle");
  }, [recursive, extensions]);

  useEffect(() => {
    if (isOpen) {
      const stored = loadLastExcelMergeResult();
      const initialSources = initialInputFile
        ? [initialInputFile]
        : (stored?.sources ?? []);
      setSources(initialSources);
      setRecursive(stored?.recursive ?? false);
      setExtensions(stored?.extensions ?? [...DEFAULT_EXTENSIONS]);
      setSheetMode(stored?.sheetMode ?? "first");
      setSheetName(stored?.sheetName ?? "");
      setMissingSheet(stored?.missingSheet ?? "error");
      setAlign(stored?.align ?? "union");
      setSourceColumn(stored?.sourceColumn ?? "file_sheet");
      setSourceColumnName("source");
      setOutputPathInput(stored?.outputPathInput ?? "");
      setOutputFormat(stored?.outputFormat ?? "xlsx");
      setLastResult(stored);
      setIsStaleResult(stored !== null);
      setError(null);
      setScanResult(null);
      setScanStatus("idle");
      setExcluded([]);
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

  const scanKey = useMemo(
    () =>
      JSON.stringify({
        sources,
        recursive,
        extensions: [...extensions].sort(),
      }),
    [sources, recursive, extensions],
  );
  const scanKeyRef = useRef(scanKey);
  scanKeyRef.current = scanKey;
  const scanSeq = useRef(0);

  const runScan = useCallback(
    async (key: string) => {
      if (sources.length === 0) return;
      const seq = ++scanSeq.current;
      setScanStatus("scanning");
      setError(null);
      try {
        const data = await invoke<ExcelScanResult>("scan_excel_sources", {
          roots: sources,
          recursive,
          extensions,
        });
        if (seq === scanSeq.current && key === scanKeyRef.current) {
          setScanResult(data);
          setScanStatus("done");
        }
      } catch (err) {
        if (seq === scanSeq.current && key === scanKeyRef.current) {
          setScanStatus("error");
          setError(String(err));
        }
      }
    },
    [sources, recursive, extensions],
  );

  // Debounced auto-scan when the discovery options change (design 025 §3.7).
  useEffect(() => {
    if (!isOpen || sources.length === 0) return;
    const key = scanKey;
    const timer = window.setTimeout(() => {
      void runScan(key);
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scanKey]);

  const addFiles = useCallback(async () => {
    const picked = await open({
      multiple: true,
      filters: [
        { name: "Excel", extensions: EXTENSION_OPTIONS.slice() },
        { name: "All", extensions: ["*"] },
      ],
    });
    const files = Array.isArray(picked) ? picked : picked ? [picked] : [];
    if (files.length === 0) return;
    clearFeedback();
    setSources((prev) => {
      const set = new Set(prev);
      for (const f of files) set.add(f);
      return [...set];
    });
  }, [clearFeedback]);

  const addFolder = useCallback(async () => {
    const dir = await open({ multiple: false, directory: true });
    if (!dir) return;
    clearFeedback();
    setSources((prev) => (prev.includes(dir) ? prev : [...prev, dir]));
  }, [clearFeedback]);

  const removeSource = useCallback(
    (path: string) => {
      clearFeedback();
      setSources((prev) => prev.filter((p) => p !== path));
    },
    [clearFeedback],
  );

  // Auto-scan once when the user switches to "指定名称" without results, so
  // the sheet-name dropdown is not empty (§3.7).
  useEffect(() => {
    if (
      isOpen &&
      sheetMode === "name" &&
      scanStatus === "idle" &&
      sources.length > 0
    ) {
      void runScan(scanKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sheetMode]);

  /** Remove a workbook from the merge (reversible, §3.7). */
  const toggleExclude = useCallback(
    (path: string) => {
      clearFeedback();
      setExcluded((prev) =>
        prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
      );
    },
    [clearFeedback],
  );

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

  const handleOpenPaths = useCallback(async () => {
    if (!lastResult) return;
    try {
      await invoke("reveal_paths", { paths: [lastResult.outputPath] });
    } catch (err) {
      onShowToast?.(String(err), "error");
    }
  }, [lastResult, onShowToast]);

  const handleClearRecord = useCallback(() => {
    clearLastExcelMergeResult();
    setLastResult(null);
    setIsStaleResult(false);
  }, []);

  const handleMerge = useCallback(async () => {
    if (sources.length === 0) {
      setError(t.mergeExcelNoSources);
      return;
    }
    if (sheetMode === "name" && sheetName.trim() === "") {
      // Decided: no silent fallback to the first sheet (design 025 §3.7).
      setError(t.mergeExcelSheetNameEmpty);
      return;
    }
    clearFeedback();
    setIsMerging(true);
    try {
      const data = await invoke<ExcelMergeResult>("merge_excel_sources", {
        request: {
          roots: sources,
          recursive,
          extensions,
          sheetMode,
          sheetName: sheetMode === "name" ? sheetName.trim() : null,
          missingSheet,
          align,
          sourceColumn,
          sourceColumnName: null,
          outputPath: outputPathInput.trim(),
          outputFormat,
          outDelimiter: null,
          exclude: excluded,
        },
      });
      const stored: StoredExcelMergeResult = {
        outputPath: data.output_path,
        outputFormat: data.output_format,
        sourceFileCount: data.source_file_count,
        sheetCount: data.sheet_count,
        totalRows: data.total_rows,
        header: data.header,
        skipped: data.skipped,
        // Backend payloads are snake_case; the stored record is camelCase.
        unionSummary: data.union_summary
          ? {
              finalColumns: data.union_summary.final_columns,
              notInAllParts: data.union_summary.not_in_all_parts.map(
                (coverage) => ({
                  column: coverage.column,
                  presentIn: coverage.present_in,
                  total: coverage.total,
                }),
              ),
              nearDuplicateColumns: data.union_summary.near_duplicate_columns,
            }
          : null,
        finishedAt: new Date().toISOString(),
        elapsedMs: data.elapsed_ms,
        sources: [...sources],
        recursive,
        extensions: [...extensions],
        sheetMode,
        sheetName: sheetName.trim(),
        missingSheet,
        align,
        sourceColumn,
        outputPathInput: outputPathInput.trim(),
      };
      saveLastExcelMergeResult(stored);
      setLastResult(stored);
      setIsStaleResult(false);
      // The scan result is still valid (the options did not change), but the
      // preview shows the merged table now — keep it as is.
    } catch (err) {
      setError(String(err));
      if (!isOpen) {
        onShowToast?.(String(err), "error");
      }
    } finally {
      setIsMerging(false);
    }
  }, [
    sources,
    sheetMode,
    sheetName,
    recursive,
    extensions,
    missingSheet,
    align,
    sourceColumn,
    outputPathInput,
    outputFormat,
    excluded,
    t,
    clearFeedback,
    isOpen,
    onShowToast,
  ]);

  const outputMissing = outputExists === false;
  const canOpenPaths = outputExists !== false;
  const alignHint = ALIGN_OPTIONS.find((o) => o.value === align)?.hintKey;
  const showSourceColumnName = sourceColumn !== "none";

  if (!isOpen) return null;

  const readyLine =
    scanStatus === "scanning"
      ? t.mergeExcelScanning
      : scanResult
        ? `${t.mergeExcelScanned} · ${scanResult.file_count} ${t.mergeExcelFound}`
        : t.mergeExcelReady;

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
        className="relative bg-card border border-border/50 rounded-lg shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t.mergeExcel}
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
            {/* ── ① 选择要合并的文件 ────────────────────────── */}
            <section className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                  1
                </span>
                <span className="text-[13px] font-medium text-foreground">
                  {t.mergeExcelStep1}
                </span>
              </div>

              {scanResult ? (
                <ScrollArea
                  type="always"
                  className="h-44 rounded-md border border-border/60"
                >
                  {scanResult.files
                    .filter((f) => f.ok)
                    .map((file) => {
                      const isExcluded = excluded.includes(file.path);
                      return (
                        <div
                          key={file.path}
                          className={`flex items-center gap-2 px-2 py-1.5 text-xs border-b border-border/40 last:border-b-0 ${
                            isExcluded ? "opacity-50" : ""
                          }`}
                        >
                          <span
                            className={`flex-1 min-w-0 truncate ${
                              isExcluded
                                ? "text-muted-foreground/50 line-through"
                                : "text-foreground/80"
                            }`}
                          >
                            {file.path}
                          </span>
                          {file.sheets.map((name) => (
                            <span
                              key={name}
                              className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground shrink-0"
                            >
                              {name}
                            </span>
                          ))}
                          {isExcluded && (
                            <span className="text-[11px] text-amber-600 shrink-0">
                              {t.mergeExcelExcluded}
                            </span>
                          )}
                          <button
                            onClick={() => toggleExclude(file.path)}
                            aria-label={`${
                              isExcluded
                                ? t.mergeExcelRestore
                                : t.mergeExcelExclude
                            }: ${file.path}`}
                            title={
                              isExcluded
                                ? t.mergeExcelRestore
                                : t.mergeExcelExclude
                            }
                            className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground shrink-0"
                          >
                            {isExcluded ? (
                              <RotateCcw className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                </ScrollArea>
              ) : (
                <div className="rounded-md border border-border/60 px-2 py-1.5">
                  {sources.map((path) => (
                    <div
                      key={path}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs"
                    >
                      <span className="flex-1 min-w-0 truncate text-foreground/80">
                        {path}
                      </span>
                      <button
                        onClick={() => removeSource(path)}
                        aria-label={path}
                        className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-2.5">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(e) => {
                      clearFeedback();
                      setRecursive(e.target.checked);
                    }}
                    className="accent-primary"
                  />
                  {t.mergeExcelRecursive}
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  className="ml-auto"
                  onClick={addFiles}
                >
                  {t.mergeExcelAddFiles}
                </Button>
                <Button variant="secondary" size="sm" onClick={addFolder}>
                  {t.mergeExcelAddFolder}
                </Button>
              </div>

              <p
                className={`flex items-center gap-1.5 text-[11px] mt-2 ${
                  scanStatus === "scanning"
                    ? "text-muted-foreground"
                    : scanStatus === "error"
                      ? "text-red-600"
                      : "text-green-600"
                }`}
              >
                {scanStatus === "scanning"
                  ? t.mergeExcelScanning
                  : scanResult
                    ? `${t.mergeExcelScanned} · ${scanResult.file_count} ${t.mergeExcelFound}`
                    : ""}
              </p>
              {scanResult?.warnings.map((warning) => (
                <p
                  key={warning}
                  className="flex items-center gap-1.5 text-[11px] text-amber-600"
                >
                  <AlertCircle className="h-3 w-3" />
                  {warning}
                </p>
              ))}
            </section>

            {/* ── ② 合并哪些 sheet ──────────────────────────── */}
            <section className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                  2
                </span>
                <span className="text-[13px] font-medium text-foreground">
                  {t.mergeExcelSheetMode}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SHEET_MODE_CARDS.map((card) => {
                  const selected = sheetMode === card.value;
                  return (
                    <button
                      key={card.value}
                      onClick={() => {
                        clearFeedback();
                        setSheetMode(card.value);
                      }}
                      aria-pressed={selected}
                      className={`text-left rounded-md p-2.5 border transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border/60 hover:bg-accent"
                      }`}
                    >
                      <span
                        className={`block text-xs font-medium ${
                          selected ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {t[card.labelKey]}
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                        {t[card.subKey]}
                      </span>
                    </button>
                  );
                })}
              </div>
              {sheetMode === "name" && (
                <div className="flex items-center gap-2 mt-3">
                  <label className="text-xs text-muted-foreground shrink-0 w-26">
                    {t.mergeExcelSheetByName}
                  </label>
                  <div className="flex-1 min-w-0">
                    <Select
                      value={sheetName}
                      onChange={(v) => {
                        clearFeedback();
                        setSheetName(v);
                      }}
                      options={(scanResult?.sheet_names ?? []).map((name) => ({
                        value: name,
                        label: name,
                      }))}
                      placeholder={t.mergeExcelSheetNameEmpty}
                      ariaLabel={t.mergeExcelSheetByName}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ── ③ 输出 ────────────────────────────────────── */}
            <section className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                  3
                </span>
                <span className="text-[13px] font-medium text-foreground">
                  {t.mergeExcelStep3}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0 w-24">
                  {t.mergeExcelOutputFormat}
                </label>
                <div className="w-32">
                  <Select
                    value={outputFormat}
                    onChange={(v) => {
                      clearFeedback();
                      setOutputFormat(v as ExcelOutputFormat);
                    }}
                    options={OUTPUT_FORMAT_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    ariaLabel={t.mergeExcelOutputFormat}
                  />
                </div>
                <input
                  type="text"
                  value={outputPathInput}
                  onChange={(e) => {
                    clearFeedback();
                    setOutputPathInput(e.target.value);
                  }}
                  placeholder={t.outputPathLeaveEmpty}
                  className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
                />
              </div>
            </section>

            {/* ── 高级选项(默认折叠) ────────────────────────── */}
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className="w-full flex items-center gap-2 rounded-lg border border-border/50 p-3 text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              {advancedOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {t.mergeExcelAdvanced}
              <span className="text-[11px] text-muted-foreground/70">
                {t.mergeExcelAlign} · {t.mergeExcelSourceColumn}
              </span>
            </button>
            {advancedOpen && (
              <div className="rounded-lg border border-border/50 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground shrink-0 w-24">
                    {t.mergeExcelAlign}
                  </label>
                  <div className="flex-1 min-w-0">
                    <Select
                      value={align}
                      onChange={(v) => {
                        clearFeedback();
                        setAlign(v as ExcelAlign);
                      }}
                      options={ALIGN_OPTIONS.map((o) => ({
                        value: o.value,
                        label: t[o.labelKey],
                      }))}
                      ariaLabel={t.mergeExcelAlign}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/80 pl-[6.5rem] -mt-1.5">
                  {alignHint && t[alignHint]}
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground shrink-0 w-24">
                    {t.mergeExcelSourceColumn}
                  </label>
                  <div className="flex-1 min-w-0">
                    <Select
                      value={sourceColumn}
                      onChange={(v) => {
                        clearFeedback();
                        setSourceColumn(v as ExcelSourceColumn);
                      }}
                      options={SOURCE_COLUMN_OPTIONS.map((o) => ({
                        value: o.value,
                        label: t[o.labelKey],
                      }))}
                      ariaLabel={t.mergeExcelSourceColumn}
                    />
                  </div>
                  {showSourceColumnName && (
                    <input
                      type="text"
                      value={sourceColumnName}
                      onChange={(e) => {
                        clearFeedback();
                        setSourceColumnName(e.target.value);
                      }}
                      placeholder={t.mergeExcelSourceColumnName}
                      className="w-32 h-8 px-2 text-xs border rounded-md bg-background"
                    />
                  )}
                </div>
                {sheetMode === "name" && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0 w-24">
                      {t.mergeExcelMissingSheet}
                    </label>
                    <div className="flex-1 min-w-0">
                      <Select
                        value={missingSheet}
                        onChange={(v) => {
                          clearFeedback();
                          setMissingSheet(v as ExcelMissingSheet);
                        }}
                        options={MISSING_SHEET_OPTIONS.map((o) => ({
                          value: o.value,
                          label: t[o.labelKey],
                        }))}
                        ariaLabel={t.mergeExcelMissingSheet}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="px-4 py-2 bg-red-500/10 text-red-600 text-xs flex items-center gap-2 rounded-md">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}

            {/* ── 结果卡 ────────────────────────────────────── */}
            <div className="rounded-lg border border-border/50 p-3">
              {lastResult ? (
                <div className="space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-green-600">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {isStaleResult
                        ? t.mergeExcelLastResult
                        : t.mergeExcelComplete}
                    </span>
                    <span className="font-normal text-muted-foreground">
                      · {t.finishedAt}{" "}
                      {formatDateTime(new Date(lastResult.finishedAt))}
                      {formatElapsed(lastResult.elapsedMs) !== "" &&
                        ` · ${t.elapsed} ${formatElapsed(lastResult.elapsedMs)}`}
                    </span>
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t.mergeExcelFileCount}
                      </p>
                      <p className="text-base font-medium text-foreground">
                        {lastResult.sourceFileCount}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t.mergeExcelSheetCount}
                      </p>
                      <p className="text-base font-medium text-foreground">
                        {lastResult.sheetCount}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t.mergeExcelRowCount}
                      </p>
                      <p className="text-base font-medium text-foreground">
                        {lastResult.totalRows}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t.mergeExcelOutputFormat}
                      </p>
                      <p className="text-sm font-medium text-foreground uppercase">
                        {lastResult.outputFormat}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    <span className="text-muted-foreground/60">
                      {t.mergeExcelColumnsHeader}:{" "}
                    </span>
                    {lastResult.header.join(", ")}
                  </p>
                  {lastResult.outputFormat === "xlsx" && (
                    <p className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
                      {t.mergeExcelOutputSheetNote}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/80 break-all">
                    {lastResult.outputPath}
                  </p>
                  {(lastResult.skipped.length > 0 ||
                    lastResult.unionSummary) && (
                    <div className="space-y-1 rounded-md bg-amber-500/10 p-2.5">
                      {lastResult.skipped.map((entry) => (
                        <p
                          key={entry}
                          className="flex items-center gap-2 text-xs text-amber-600"
                        >
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {entry}
                        </p>
                      ))}
                      {lastResult.unionSummary?.notInAllParts.map(
                        (coverage: {
                          column: string;
                          presentIn: number;
                          total: number;
                        }) => (
                          <p
                            key={coverage.column}
                            className="flex items-center gap-2 text-xs text-amber-600"
                          >
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {t.mergeExcelUnionWidened}: {coverage.column}{" "}
                            {t.mergeExcelUnionColumnNotInAll
                              .replace("{present}", String(coverage.presentIn))
                              .replace("{total}", String(coverage.total))}
                          </p>
                        ),
                      )}
                      {lastResult.unionSummary?.nearDuplicateColumns.map(
                        ([a, b]: [string, string]) => (
                          <p
                            key={`${a}|${b}`}
                            className="flex items-center gap-2 text-xs text-amber-600"
                          >
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {t.mergeExcelUnionNearDuplicate
                              .replace("{a}", a)
                              .replace("{b}", b)}
                          </p>
                        ),
                      )}
                    </div>
                  )}
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
                  {t.mergeExcelHint}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* footer: status + primary action */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-muted/20 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {readyLine}
          </span>
          <Button size="sm" onClick={handleMerge} disabled={isMerging}>
            {isMerging ? t.mergeExcelRunning : t.mergeExcelStart}
          </Button>
        </div>
      </div>
    </div>
  );
}
