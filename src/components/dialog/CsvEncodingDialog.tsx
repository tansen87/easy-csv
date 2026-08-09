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

export interface CsvEncodingResult {
  output_path: string;
  bytes_read: number;
  bytes_written: number;
}

interface CsvEncodingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
}

const ENCODINGS = [
  { value: "auto", label: "Auto detect (BOM)" },
  { value: "utf-8", label: "UTF-8" },
  { value: "gbk", label: "GBK / GB2312" },
  { value: "gb18030", label: "GB18030" },
  { value: "utf-16le", label: "UTF-16 LE" },
  { value: "utf-16be", label: "UTF-16 BE" },
  { value: "latin1", label: "Latin-1 / Windows-1252" },
];

export function CsvEncodingDialog({
  isOpen,
  onClose,
  initialInputFile,
}: CsvEncodingDialogProps) {
  const { t } = useLanguage();
  const [inputFile, setInputFile] = useState("");
  const [outputFile, setOutputFile] = useState("");
  const [sourceEncoding, setSourceEncoding] = useState("auto");
  const [targetEncoding, setTargetEncoding] = useState("utf-8");
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<CsvEncodingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputFile(initialInputFile || "");
      setOutputFile("");
      setSourceEncoding("auto");
      setTargetEncoding("utf-8");
      setResult(null);
      setError(null);
    }
  }, [isOpen, initialInputFile]);

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
      setInputFile(file);
      const extIndex = file.lastIndexOf(".");
      const ext = extIndex >= 0 ? file.slice(extIndex) : ".csv";
      setOutputFile(`${file.slice(0, extIndex)}_utf8${ext}`);
    }
  }, []);

  const browseOutput = useCallback(async () => {
    const file = await save({
      filters: [
        { name: "CSV", extensions: ["csv", "txt", "tsv"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (file) {
      setOutputFile(file);
    }
  }, []);

  const handleConvert = useCallback(async () => {
    if (!inputFile || !outputFile) {
      setError(t.csvEncodingSelectFiles);
      return;
    }
    setError(null);
    setResult(null);
    if (sourceEncoding === targetEncoding) {
      setError(t.csvEncodingSameEncoding);
      return;
    }
    setIsConverting(true);
    try {
      const data = await invoke<CsvEncodingResult>("convert_csv_encoding", {
        inputPath: inputFile,
        outputPath: outputFile,
        sourceEncoding,
        targetEncoding,
      });
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsConverting(false);
    }
  }, [inputFile, outputFile, sourceEncoding, targetEncoding, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-card"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-card w-full h-full flex flex-col overflow-hidden outline-none"
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
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* File + encoding selection area */}
        <div className="px-4 py-3 border-b border-border/50 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground w-10 shrink-0">
              {t.csvEncodingInputFile}
            </label>
            <input
              type="text"
              value={inputFile}
              onChange={(e) => setInputFile(e.target.value)}
              placeholder={t.csvEncodingInputFile}
              className="flex-1 h-8 px-2 text-xs border rounded-md bg-background"
              readOnly
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
            <label className="text-xs font-medium text-muted-foreground w-10 shrink-0">
              {t.csvEncodingOutputFile}
            </label>
            <input
              type="text"
              value={outputFile}
              onChange={(e) => setOutputFile(e.target.value)}
              placeholder={t.csvEncodingOutputFile}
              className="flex-1 h-8 px-2 text-xs border rounded-md bg-background"
              readOnly
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
            <label className="text-xs font-medium text-muted-foreground w-25 shrink-0">
              {t.csvEncodingSourceEncoding}
            </label>
            <div className="w-46">
              <SearchableSelect
                value={sourceEncoding}
                onChange={setSourceEncoding}
                options={ENCODINGS}
                size="sm"
              />
            </div>
            <label className="text-xs font-medium text-muted-foreground w-25 shrink-0">
              {t.csvEncodingTargetEncoding}
            </label>
            <div className="w-46">
              <SearchableSelect
                value={targetEncoding}
                onChange={setTargetEncoding}
                options={ENCODINGS.filter((e) => e.value !== "auto")}
                size="sm"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleConvert}
              disabled={isConverting}
              className="ml-auto"
            >
              {isConverting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileCode className="h-3.5 w-3.5" />
              )}
              {isConverting ? t.csvEncodingConverting : t.csvEncodingConvert}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <div className="flex flex-1 items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t.csvEncodingSuccess}
                </span>
                <span className="text-muted-foreground/70">
                  {result.bytes_read} {t.csvEncodingBytes} →{" "}
                  {result.bytes_written} {t.csvEncodingBytes}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-500/10 text-red-600 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {/* Helper hint */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="rounded border border-border/50 p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t.csvEncodingNoResult}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/80">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-500/60" />
                {t.csvEncodingSuccess}: {result?.output_path ?? "—"}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
