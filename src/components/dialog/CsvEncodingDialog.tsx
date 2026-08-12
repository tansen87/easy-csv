import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  X,
  FolderOpen,
  FileCode,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useLanguage } from "@/i18n";
import type { ToastType } from "@/components/setting/Toast";

export interface CsvEncodingResult {
  output_path: string;
  bytes_read: number;
  bytes_written: number;
}

interface CsvEncodingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
  onShowToast?: (message: string, type?: ToastType) => void;
}

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

export function CsvEncodingDialog({
  isOpen,
  onClose,
  initialInputFile,
  onShowToast,
}: CsvEncodingDialogProps) {
  const { t } = useLanguage();
  const [inputFile, setInputFile] = useState("");
  const [outputFile, setOutputFile] = useState("");
  const [sourceEncoding, setSourceEncoding] = useState("utf-8");
  const [targetEncoding, setTargetEncoding] = useState("utf-8");
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<CsvEncodingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const autoBaseRef = useRef<{ name: string; ext: string } | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const isSameEncoding = sourceEncoding === targetEncoding;

  const clearFeedback = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  const suffixFor = useCallback((encoding: string) => {
    return ENCODING_SUFFIXES[encoding] ?? "utf8";
  }, []);

  useEffect(() => {
    if (isOpen) {
      setInputFile(initialInputFile || "");
      setOutputFile("");
      setSourceEncoding("utf-8");
      setTargetEncoding("utf-8");
      setResult(null);
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
      setResult(data);
      if (!isOpenRef.current) {
        onShowToast?.(
          `${t.csvEncodingSuccess}: ${data.output_path}`,
          "success",
        );
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
            <FileCode className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {t.csvEncoding}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
            aria-label={t.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* File + encoding selection area */}
        <div className="px-4 py-3 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t.csvEncodingInputFile}
            </label>
            <input
              type="text"
              value={inputFile}
              onChange={(e) => {
                clearFeedback();
                autoBaseRef.current = null;
                setInputFile(e.target.value);
              }}
              placeholder={t.csvEncodingInputFile}
              className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
            />
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={browseInput}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t.csvEncodingBrowse}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t.csvEncodingOutputFile}
            </label>
            <input
              type="text"
              value={outputFile}
              onChange={(e) => {
                clearFeedback();
                autoBaseRef.current = null;
                setOutputFile(e.target.value);
              }}
              placeholder={t.csvEncodingOutputFile}
              className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
            />
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={browseOutput}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t.csvEncodingBrowse}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              {t.csvEncodingSourceEncoding}
            </label>
            <div className="flex-1 min-w-0">
              <SearchableSelect
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
              {t.csvEncodingTargetEncoding}
            </label>
            <div className="flex-1 min-w-0">
              <SearchableSelect
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
              {isConverting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileCode className="h-3.5 w-3.5" />
              )}
              {isConverting ? t.csvEncodingConverting : t.csvEncodingConvert}
            </Button>
          </div>
          {isSameEncoding && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {t.csvEncodingSameEncoding}
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
              {result ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-medium text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {t.csvEncodingSuccess}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.bytes_read} {t.csvEncodingBytes} →{" "}
                    {result.bytes_written} {t.csvEncodingBytes}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground/80 break-all">
                    <FileCode className="h-3.5 w-3.5 shrink-0" />
                    {result.output_path}
                  </p>
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
