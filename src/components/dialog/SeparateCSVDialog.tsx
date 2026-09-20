import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  X,
  FolderOpen,
  FileCode,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";
import type { ToastType } from "@/components/setting/Toast";

export interface SeparateResult {
  good_path: string;
  bad_path: string;
  good_rows: number;
  bad_rows: number;
  expected_columns: number;
}

interface SeparateCSVDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialInputFile?: string;
  defaultDelimiter?: string;
  onShowToast?: (message: string, type?: ToastType) => void;
}

export function SeparateCSVDialog({
  isOpen,
  onClose,
  initialInputFile,
  defaultDelimiter,
  onShowToast,
}: SeparateCSVDialogProps) {
  const { t } = useLanguage();
  const [inputFile, setInputFile] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [quoting, setQuoting] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [expectedColumns, setExpectedColumns] = useState("");
  const [skiprows, setSkiprows] = useState("0");
  const [isSeparating, setIsSeparating] = useState(false);
  const [result, setResult] = useState<SeparateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const clearFeedback = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setInputFile(initialInputFile || "");
      setOutputDir("");
      setDelimiter(defaultDelimiter || ",");
      setQuoting(true);
      setStreaming(false);
      setExpectedColumns("");
      setSkiprows("0");
      setResult(null);
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
        delimiter: delimiter || ",",
        quoting,
        expectedColumns:
          expectedColumns.trim() === "" ? null : expectedColumns.trim(),
        skiprows: skip,
        outDir: outputDir.trim() === "" ? null : outputDir.trim(),
        streaming,
      });
      setResult(data);
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
    delimiter,
    quoting,
    streaming,
    expectedColumns,
    skiprows,
    t,
    clearFeedback,
    isOpen,
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
        className="relative bg-card border border-border/50 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] min-h-[400px] flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-primary" />
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
              <FolderOpen className="h-3.5 w-3.5" />
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
              placeholder={t.inputFile}
              className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
            />
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={browseOutputDir}
            >
              <FolderOpen className="h-3.5 w-3.5" />
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
              placeholder={t.expectedColumnsHint}
              className="flex-1 min-w-0 h-8 px-2 text-xs border rounded-md bg-background"
            />
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
            <label
              className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0"
            >
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
              {result ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {t.separateComplete}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.goodRows}: {result.good_rows} · {t.badRows}:{" "}
                    {result.bad_rows} · {t.expectedColumns}:{" "}
                    {result.expected_columns}
                  </p>
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground/80 break-all">
                      <FileCode className="h-3.5 w-3.5 shrink-0" />
                      {result.good_path}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground/80 break-all">
                      <FileCode className="h-3.5 w-3.5 shrink-0" />
                      {result.bad_path}
                    </p>
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
