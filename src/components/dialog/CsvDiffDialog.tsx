import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  X,
  FolderOpen,
  GitCompareArrows,
  RefreshCw,
  Plus,
  Minus,
  Pencil,
  AlertCircle,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useLanguage } from "@/i18n";

export interface CsvDiffEntry {
  status: "equal" | "added" | "removed" | "modified";
  left_line: number | null;
  right_line: number | null;
  left_cells: string[] | null;
  right_cells: string[] | null;
  changed_cols: number[];
  count: number;
}

export interface CsvDiffResult {
  headers_left: string[];
  headers_right: string[];
  key_cols: number[];
  entries: CsvDiffEntry[];
  equal_count: number;
  added_count: number;
  removed_count: number;
  modified_count: number;
}

const PAGE_SIZE = 500;

interface CsvDiffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDelimiter: string;
  initialFileA?: string;
}

const DELIMITERS = [
  { value: ",", label: "Comma (,)" },
  { value: "\t", label: "Tab (\\t)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "|", label: "Pipe (|)" },
];

export function CsvDiffDialog({
  isOpen,
  onClose,
  defaultDelimiter,
  initialFileA,
}: CsvDiffDialogProps) {
  const { t } = useLanguage();
  const [fileA, setFileA] = useState("");
  const [fileB, setFileB] = useState("");
  const [delimiter, setDelimiter] = useState(defaultDelimiter || ",");
  const [headersA, setHeadersA] = useState<string[] | null>(null);
  const [keyColumns, setKeyColumns] = useState<number[]>([]);
  const [result, setResult] = useState<CsvDiffResult | null>(null);
  const [page, setPage] = useState(0);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFileA(initialFileA || "");
      setFileB("");
      setResult(null);
      setError(null);
      setDelimiter(defaultDelimiter || ",");
      setKeyColumns([]);
      setPage(0);
    }
  }, [isOpen, initialFileA, defaultDelimiter]);

  useEffect(() => {
    if (!fileA) {
      setHeadersA(null);
      return;
    }
    let cancelled = false;
    invoke<{ headers: string[]; rows: string[][] }>("read_csv_file", {
      filePath: fileA,
      delimiter,
      limit: 0,
    })
      .then((d) => {
        if (!cancelled) setHeadersA(d.headers);
      })
      .catch(() => {
        if (!cancelled) setHeadersA(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fileA, delimiter]);

  const toggleKeyColumn = useCallback((col: number) => {
    setKeyColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  }, []);

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

  const browseFile = useCallback(async (side: "a" | "b") => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV", extensions: ["csv", "txt", "tsv"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (file) {
      if (side === "a") setFileA(file);
      else setFileB(file);
    }
  }, []);

  const handleCompare = useCallback(async () => {
    if (!fileA || !fileB) {
      setError(t.csvDiffSelectBoth);
      return;
    }
    setIsComparing(true);
    setError(null);
    try {
      const data = await invoke<CsvDiffResult>("diff_csv_files", {
        fileA,
        fileB,
        delimiterA: delimiter,
        delimiterB: delimiter,
        keyColumns: keyColumns.length ? keyColumns : null,
      });
      setResult(data);
      setPage(0);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsComparing(false);
    }
  }, [fileA, fileB, delimiter, keyColumns, t]);

  if (!isOpen) return null;

  const statusStyles: Record<
    CsvDiffEntry["status"],
    { row: string; cell: string }
  > = {
    equal: { row: "", cell: "" },
    added: { row: "bg-green-500/10", cell: "" },
    removed: { row: "bg-red-500/10", cell: "" },
    modified: { row: "bg-yellow-500/10", cell: "" },
  };

  const renderCell = (
    value: string | undefined,
    colIdx: number,
    entry: CsvDiffEntry,
  ) => {
    const isChanged = entry.changed_cols.includes(colIdx);
    return (
      <td
        key={colIdx}
        className={`border border-border/30 px-2 py-1 text-xs whitespace-nowrap min-w-[90px] max-w-[240px] truncate ${
          isChanged ? "bg-yellow-400/20 font-medium" : ""
        }`}
      >
        {value ?? ""}
      </td>
    );
  };

  const renderRow = (entry: CsvDiffEntry) => {
    const headersLeftLen = result?.headers_left.length ?? 0;
    const headersRightLen = result?.headers_right.length ?? 0;

    if (entry.status === "equal") {
      const leftRange =
        entry.count > 1 && entry.left_line != null
          ? `–${entry.left_line + entry.count - 1}`
          : "";
      const rightRange =
        entry.count > 1 && entry.right_line != null
          ? `–${entry.right_line + entry.count - 1}`
          : "";
      return (
        <tr
          key={`eq-${entry.left_line}-${entry.right_line}`}
          className="bg-muted/10"
        >
          <td
            colSpan={2}
            className="border border-border/30 px-2 py-1 text-xs text-right text-muted-foreground tabular-nums select-none"
          >
            {entry.left_line}
            {leftRange}
          </td>
          <td
            colSpan={headersLeftLen}
            className="border border-border/30 px-2 py-1 text-[11px] text-center text-muted-foreground"
          >
            ≈ {entry.count} {t.equalRows}
          </td>
          <td
            colSpan={2 + headersRightLen}
            className="border border-border/30 px-2 py-1 text-xs text-center text-muted-foreground tabular-nums select-none"
          >
            {entry.right_line}
            {rightRange}
          </td>
        </tr>
      );
    }

    const style = statusStyles[entry.status];
    const leftCells = entry.left_cells || [];
    const rightCells = entry.right_cells || [];
    const keyCols = result?.key_cols ?? [];

    // For modified rows, cells contain only key + changed columns; map each
    // column index back to its position in the projected cell arrays.
    const shownCols =
      entry.status === "modified"
        ? Array.from(new Set([...keyCols, ...entry.changed_cols])).sort(
            (a, b) => a - b,
          )
        : null;

    const leftValueAt = (col: number): string | undefined => {
      if (entry.status === "removed") return leftCells[col];
      if (entry.status === "added") return undefined;
      const idx = shownCols!.indexOf(col);
      return idx >= 0 ? leftCells[idx] : undefined;
    };
    const rightValueAt = (col: number): string | undefined => {
      if (entry.status === "added") return rightCells[col];
      if (entry.status === "removed") return undefined;
      const idx = shownCols!.indexOf(col);
      return idx >= 0 ? rightCells[idx] : undefined;
    };

    return (
      <tr
        key={`${entry.left_line ?? "a"}-${entry.right_line ?? "b"}`}
        className={`${style.row} font-medium`}
      >
        <td className="border border-border/30 px-2 py-1 text-xs text-right text-muted-foreground tabular-nums w-12 select-none">
          {entry.status === "removed" || entry.status === "modified" ? (
            <span className="inline-flex items-center gap-1">
              {entry.status === "removed" ? (
                <Minus className="h-3 w-3 text-red-500" />
              ) : (
                <Pencil className="h-3 w-3 text-yellow-500" />
              )}
              {entry.left_line}
            </span>
          ) : null}
        </td>
        <td className="border border-border/30 px-2 py-1 text-xs w-12 text-center select-none">
          {entry.status === "added" ? (
            <Plus className="h-3 w-3 text-green-500 mx-auto" />
          ) : null}
        </td>
        {Array.from({ length: headersLeftLen }).map((_, colIdx) =>
          entry.status === "added" ? (
            <td
              key={`al-${colIdx}`}
              className="border border-border/30 px-2 py-1"
            />
          ) : (
            renderCell(leftValueAt(colIdx), colIdx, entry)
          ),
        )}
        <td className="border border-border/30 px-2 py-1 text-xs text-right text-muted-foreground tabular-nums w-12 select-none">
          {entry.status === "added" || entry.status === "modified" ? (
            <span className="inline-flex items-center gap-1">
              {entry.status === "added" ? (
                <Plus className="h-3 w-3 text-green-500" />
              ) : (
                <Pencil className="h-3 w-3 text-yellow-500" />
              )}
              {entry.right_line}
            </span>
          ) : null}
        </td>
        <td className="border border-border/30 px-2 py-1 text-xs w-12 text-center select-none">
          {entry.status === "removed" ? (
            <Minus className="h-3 w-3 text-red-500 mx-auto" />
          ) : null}
        </td>
        {Array.from({ length: headersRightLen }).map((_, colIdx) =>
          entry.status === "removed" ? (
            <td
              key={`ar-${colIdx}`}
              className="border border-border/30 px-2 py-1"
            />
          ) : (
            renderCell(rightValueAt(colIdx), colIdx, entry)
          ),
        )}
      </tr>
    );
  };

  const totalPages = result
    ? Math.max(1, Math.ceil(result.entries.length / PAGE_SIZE))
    : 1;
  const pageStart = result ? Math.min(page, totalPages - 1) * PAGE_SIZE : 0;
  const visibleEntries = result
    ? result.entries.slice(pageStart, pageStart + PAGE_SIZE)
    : [];

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
            <GitCompareArrows className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {t.csvDiff}
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

        {/* File selection area */}
        <div className="px-4 py-3 border-b border-border/50 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground w-10 shrink-0">
              {t.fileA}
            </label>
            <input
              type="text"
              value={fileA}
              onChange={(e) => setFileA(e.target.value)}
              placeholder={t.csvDiffFileAPlaceholder}
              className="flex-1 h-8 px-2 text-xs border rounded-md bg-background"
              readOnly
            />
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => browseFile("a")}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t.open}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground w-10 shrink-0">
              {t.fileB}
            </label>
            <input
              type="text"
              value={fileB}
              onChange={(e) => setFileB(e.target.value)}
              placeholder={t.csvDiffFileBPlaceholder}
              className="flex-1 h-8 px-2 text-xs border rounded-md bg-background"
              readOnly
            />
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => browseFile("b")}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t.open}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground w-10 shrink-0">
              {t.keyColumns}
            </label>
            {headersA && headersA.length > 0 ? (
              <ScrollArea className="flex-1 max-h-9">
                <div className="flex w-max items-center gap-1 py-0.5 pr-1">
                  {headersA.map((h, i) => {
                    const selected = keyColumns.includes(i);
                    return (
                      <button
                        key={`kc-${i}`}
                        onClick={() => toggleKeyColumn(i)}
                        className={`px-2 py-1 text-[11px] rounded border whitespace-nowrap shrink-0 transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-accent"
                        }`}
                      >
                        {h || `#${i + 1}`}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t.keyColumnsHint}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground w-10 shrink-0">
              {t.csvDelimiter}
            </label>
            <div className="w-32">
              <SearchableSelect
                value={delimiter}
                onChange={setDelimiter}
                options={DELIMITERS}
                size="sm"
              />
            </div>
            {result && (
              <div className="flex flex-1 items-center justify-center gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-sm bg-green-500/60" />
                    {t.added} {result.added_count}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500/60" />
                    {t.removed} {result.removed_count}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/60" />
                    {t.modify} {result.modified_count}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-sm bg-border" />
                    {t.equal} {result.equal_count}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground/70 shrink-0">
                  {result.headers_left.length} {t.columnA} /{" "}
                  {result.headers_right.length} {t.columnB}
                </span>
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCompare}
              disabled={isComparing}
              className="ml-auto"
            >
              {isComparing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitCompareArrows className="h-3.5 w-3.5" />
              )}
              {t.compare}
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-500/10 text-red-600 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {/* Results */}
        <ScrollArea className="flex-1">
          {result ? (
            <div className="p-4">
              {result.entries.length > PAGE_SIZE && (
                <div className="flex items-center gap-2 pb-2 text-xs">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    « {t.prev}
                  </Button>
                  <span className="text-muted-foreground tabular-nums">
                    {t.page} {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                  >
                    {t.next} »
                  </Button>
                  <span className="text-muted-foreground/70 ml-auto tabular-nums">
                    {pageStart + 1}–
                    {Math.min(pageStart + PAGE_SIZE, result.entries.length)} /{" "}
                    {result.entries.length}
                  </span>
                </div>
              )}
              <div className="rounded border border-border/50">
                <table className="border-collapse w-full">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th
                        colSpan={2}
                        className="bg-muted/30 border border-border/30 px-2 py-1.5 text-xs font-semibold text-left text-green-600"
                      >
                        {t.fileA}
                      </th>
                      {result.headers_left.map((h, i) => (
                        <th
                          key={`lh-${i}`}
                          className="bg-muted/30 border border-border/30 px-2 py-1.5 text-xs font-semibold text-left truncate min-w-[90px] max-w-[240px]"
                        >
                          {h}
                        </th>
                      ))}
                      <th
                        colSpan={2}
                        className="bg-muted/30 border border-border/30 px-2 py-1.5 text-xs font-semibold text-left text-green-600"
                      >
                        {t.fileB}
                      </th>
                      {result.headers_right.map((h, i) => (
                        <th
                          key={`rh-${i}`}
                          className="bg-muted/30 border border-border/30 px-2 py-1.5 text-xs font-semibold text-left truncate min-w-[90px] max-w-[240px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map(renderRow)}
                    {result.entries.length > PAGE_SIZE && (
                      <tr>
                        <td
                          colSpan={
                            4 +
                            result.headers_left.length +
                            result.headers_right.length
                          }
                          className="px-2 py-2 text-center text-xs text-muted-foreground"
                        >
                          {t.page} {page + 1} / {totalPages}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {isComparing ? t.comparing : t.csvDiffNoResult}
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
