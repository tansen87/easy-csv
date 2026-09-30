import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { formatBytes, formatDateTime, formatElapsed } from "@/utils/format";
import {
  clearLastEncodingResult,
  loadLastEncodingResult,
  saveLastEncodingResult,
  type StoredEncodingResult,
} from "@/utils/encodingHistory";
import type { ToastType } from "@/components/setting/Toast";

export interface CsvEncodingResult {
  output_path: string;
  bytes_read: number;
  bytes_written: number;
  /** Backend-reported duration; optional for older payloads/mocks. */
  elapsed_ms?: number;
}

interface CsvEncodingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
  onShowToast?: (message: string, type?: ToastType) => void;
}

const DEFAULT_ENCODING = "utf-8";

const ENCODINGS = [
  { value: "utf-8", label: "UTF-8" },
  { value: "gbk", label: "GBK / GB2312" },
  { value: "gb18030", label: "GB18030" },
  { value: "utf-16le", label: "UTF-16 LE" },
  { value: "utf-16be", label: "UTF-16 BE" },
  { value: "latin1", label: "Latin-1 / Windows-1252" },
];

const ENCODING_SUFFIXES: Record<string, string> = {
  "utf-8": "utf8",
  gbk: "gbk",
  gb18030: "gb18030",
  "utf-16le": "utf16le",
  "utf-16be": "utf16be",
  latin1: "latin1",
};

/** Display name for a raw encoding id, falling back to the id itself. */
const ENCODING_LABELS = new Map(ENCODINGS.map((e) => [e.value, e.label]));

function encodingLabel(value: string): string {
  return ENCODING_LABELS.get(value) ?? value;
}

export function CsvEncodingDialog({
  isOpen,
  onClose,
  initialInputFile,
  onShowToast,
}: CsvEncodingDialogProps) {
  const { t } = useLanguage();
  const [inputFile, setInputFile] = useState("");
  const [outputFile, setOutputFile] = useState("");
  const [sourceEncoding, setSourceEncoding] = useState(DEFAULT_ENCODING);
  const [targetEncoding, setTargetEncoding] = useState(DEFAULT_ENCODING);
  const [isConverting, setIsConverting] = useState(false);
  const [lastResult, setLastResult] = useState<StoredEncodingResult | null>(
    null,
  );
  /** The shown record is from an earlier run, not the one just finished. */
  const [isStaleResult, setIsStaleResult] = useState(false);
  /** `false` once the output file is known to be gone; `null` while unknown. */
  const [outputExists, setOutputExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const autoBaseRef = useRef<{ name: string; ext: string } | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const isSameEncoding = sourceEncoding === targetEncoding;

  /** Only feedback is cleared on edit — the last result stays visible. */
  const clearFeedback = useCallback(() => {
    setError(null);
    setIsStaleResult(true);
  }, []);

  const suffixFor = useCallback((encoding: string) => {
    return ENCODING_SUFFIXES[encoding] ?? "utf8";
  }, []);

  useEffect(() => {
    if (isOpen) {
      const stored = loadLastEncodingResult();
      setInputFile(initialInputFile || stored?.inputFile || "");
      setOutputFile(stored?.outputPath ?? "");
      setSourceEncoding(stored?.sourceEncoding ?? DEFAULT_ENCODING);
      setTargetEncoding(stored?.targetEncoding ?? DEFAULT_ENCODING);
      setLastResult(stored);
      setIsStaleResult(stored !== null);
      setError(null);
      autoBaseRef.current = null;
    }
  }, [isOpen, initialInputFile]);

  useEffect(() => {
    if (autoBaseRef.current) {
      const { name, ext } = autoBaseRef.current;
      setOutputFile(`${name}_${suffixFor(targetEncoding)}${ext}`);
    }
  }, [targetEncoding, suffixFor]);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
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
      const extIndex = file.lastIndexOf(".");
      const ext = extIndex >= 0 ? file.slice(extIndex) : ".csv";
      const name = file.slice(0, extIndex);
      autoBaseRef.current = { name, ext };
      setOutputFile(`${name}_${suffixFor(targetEncoding)}${ext}`);
    }
  }, [clearFeedback, suffixFor, targetEncoding]);

  const browseOutput = useCallback(async () => {
    const file = await save({
      filters: [
        { name: "CSV", extensions: ["csv", "txt", "tsv"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (file) {
      clearFeedback();
      autoBaseRef.current = null;
      setOutputFile(file);
    }
  }, [clearFeedback]);

  // Open the output location in the system file manager.
  const handleOpenPath = useCallback(async () => {
    if (!lastResult) return;
    try {
      await invoke("reveal_paths", { paths: [lastResult.outputPath] });
    } catch (err) {
      onShowToast?.(String(err), "error");
    }
  }, [lastResult, onShowToast]);

  const handleClearRecord = useCallback(() => {
    clearLastEncodingResult();
    setLastResult(null);
    setIsStaleResult(false);
  }, []);

  const handleConvert = useCallback(async () => {
    if (!inputFile.trim() || !outputFile.trim()) {
      setError(t.csvEncodingSelectFiles);
      return;
    }
    clearFeedback();
    setIsConverting(true);
    try {
      const data = await invoke<CsvEncodingResult>("convert_csv_encoding", {
        inputPath: inputFile,
        outputPath: outputFile,
        sourceEncoding,
        targetEncoding,
      });
      const stored: StoredEncodingResult = {
        outputPath: data.output_path,
        bytesRead: data.bytes_read,
        bytesWritten: data.bytes_written,
        finishedAt: new Date().toISOString(),
        elapsedMs: data.elapsed_ms,
        inputFile: inputFile.trim(),
        sourceEncoding,
        targetEncoding,
      };
      saveLastEncodingResult(stored);
      setLastResult(stored);
      setIsStaleResult(false);
      if (!isOpenRef.current) {
        onShowToast?.(`${t.success}: ${data.output_path}`, "success");
      }
    } catch (err) {
      setError(String(err));
      if (!isOpenRef.current) {
        onShowToast?.(String(err), "error");
      }
    } finally {
      setIsConverting(false);
    }
  }, [
    inputFile,
    outputFile,
    sourceEncoding,
    targetEncoding,
    t,
    clearFeedback,
    onShowToast,
  ]);

  /** The recorded output file is gone — worth warning the user about. */
  const outputMissing = outputExists === false;
  /** Revealing still works while the file is there (or when we could not tell). */
  const canOpenPath = outputExists !== false;

  if (!isOpen) return null;

  const elapsedText = formatElapsed(lastResult?.elapsedMs) || "—";

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
          <h3 className="text-sm font-semibold text-foreground">
            {t.csvEncoding}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea type="always" className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            {/* 选择文件 */}
            <section className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                  1
                </span>
                <span className="text-[13px] font-medium text-foreground">
                  {t.csvEncodingStep1}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0 w-16">
                  {t.inputFile}
                </label>
                <input
                  type="text"
                  value={inputFile}
                  onChange={(e) => {
                    clearFeedback();
                    autoBaseRef.current = null;
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
              <p className="text-[11px] text-muted-foreground/80 mt-2">
                {t.csvEncodingStep1Hint}
              </p>
            </section>

            {/* 编码设置 */}
            <section className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                  2
                </span>
                <span className="text-[13px] font-medium text-foreground">
                  {t.csvEncodingStep2}
                </span>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    {t.sourceEncoding}
                  </label>
                  <Select
                    value={sourceEncoding}
                    onChange={(v) => {
                      clearFeedback();
                      setSourceEncoding(v);
                    }}
                    options={ENCODINGS}
                    size="sm"
                    ariaLabel={t.sourceEncoding}
                  />
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 mb-2 text-muted-foreground" />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    {t.targetEncoding}
                  </label>
                  <Select
                    value={targetEncoding}
                    onChange={(v) => {
                      clearFeedback();
                      setTargetEncoding(v);
                    }}
                    options={ENCODINGS}
                    size="sm"
                    ariaLabel={t.targetEncoding}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/80 mt-2">
                {t.csvEncodingStep2Hint}
              </p>
            </section>

            {/* 输出文件 */}
            <section className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center">
                  3
                </span>
                <span className="text-[13px] font-medium text-foreground">
                  {t.csvEncodingStep3}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0 w-16">
                  {t.outputFile}
                </label>
                <input
                  type="text"
                  value={outputFile}
                  onChange={(e) => {
                    clearFeedback();
                    autoBaseRef.current = null;
                    setOutputFile(e.target.value);
                  }}
                  placeholder={t.outputFile}
                  className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={browseOutput}
                >
                  {t.csvEncodingSaveAs}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/80 mt-2">
                {t.csvEncodingStep3Hint}
              </p>
            </section>

            {error && (
              <div className="px-4 py-2 bg-red-500/10 text-red-600 text-xs flex items-center gap-2 rounded-md">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}

            {/* 结果卡 */}
            <div className="rounded-lg border border-border/50 p-3">
              {lastResult ? (
                <div className="space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-green-600">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {isStaleResult ? t.csvEncodingLastResult : t.success}
                    </span>
                    <span className="font-normal text-muted-foreground">
                      · {t.finishedAt}{" "}
                      {formatDateTime(new Date(lastResult.finishedAt))}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md border border-border/60 text-xs font-mono text-foreground">
                      {encodingLabel(lastResult.sourceEncoding)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="px-2 py-0.5 rounded-md border border-border/60 text-xs font-mono text-foreground">
                      {encodingLabel(lastResult.targetEncoding)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t.csvEncodingRead}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {formatBytes(lastResult.bytesRead)}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t.csvEncodingWritten}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {formatBytes(lastResult.bytesWritten)}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t.csvEncodingElapsed}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {elapsedText}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground/80 break-all">
                    {lastResult.outputPath}
                  </p>
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
                      disabled={!canOpenPath}
                      title={canOpenPath ? undefined : t.lastResultNoOutput}
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
                  {t.csvEncodingNoResult}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* footer: status + primary action */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/20 shrink-0">
          <span
            className={`flex items-center gap-1.5 text-[11px] ${
              isSameEncoding ? "text-amber-600" : "text-muted-foreground"
            }`}
          >
            {isSameEncoding && <AlertCircle className="h-3 w-3" />}
            {isSameEncoding ? t.sameEncoding : t.csvEncodingFooterHint}
          </span>
          <Button
            size="sm"
            onClick={handleConvert}
            disabled={isConverting || isSameEncoding}
          >
            {isConverting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {isConverting ? t.converting : t.convert}
          </Button>
        </div>
      </div>
    </div>
  );
}
