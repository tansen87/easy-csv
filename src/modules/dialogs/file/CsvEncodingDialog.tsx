import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { X, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { formatDateTime, formatElapsed } from "@/utils/format";
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
        className="relative bg-card border border-border/50 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] min-h-[340px] flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t.csvEncoding}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* File + encoding selection area */}
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
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
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
              {t.open}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t.sourceEncoding}
            </label>
            <div className="flex-1 min-w-0">
              <Select
                value={sourceEncoding}
                onChange={(v) => {
                  clearFeedback();
                  setSourceEncoding(v);
                }}
                options={ENCODINGS}
                size="sm"
              />
            </div>
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t.targetEncoding}
            </label>
            <div className="flex-1 min-w-0">
              <Select
                value={targetEncoding}
                onChange={(v) => {
                  clearFeedback();
                  setTargetEncoding(v);
                }}
                options={ENCODINGS}
                size="sm"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleConvert}
              disabled={isConverting || isSameEncoding}
              className="ml-auto shrink-0"
            >
              {isConverting && (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              )}
              {isConverting ? t.converting : t.convert}
            </Button>
          </div>
          {isSameEncoding && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {t.sameEncoding}
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-500/10 text-red-600 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {/* Result / helper hint */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <div className="rounded border border-border/50 p-4">
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
                      {formatElapsed(lastResult.elapsedMs) !== "" &&
                        ` · ${t.elapsed} ${formatElapsed(lastResult.elapsedMs)}`}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {encodingLabel(lastResult.sourceEncoding)} →{" "}
                    {encodingLabel(lastResult.targetEncoding)} ·{" "}
                    {lastResult.bytesRead} {t.bytes} → {lastResult.bytesWritten}{" "}
                    {t.bytes}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground/80 break-all">
                    {lastResult.outputPath}
                  </p>
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
      </div>
    </div>
  );
}
