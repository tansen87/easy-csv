import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

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
/** Width of the numbered margin rail. */
const GUTTER_WIDTH = 64;
/** Column width used once the table no longer fits and scrolls sideways. */
const DENSE_COL_WIDTH = 110;
const DENSE_THRESHOLD = 10;

const STATUS_MARK: Record<CsvDiffEntry["status"], string> = {
  equal: "≈",
  added: "+",
  removed: "-",
  modified: "~",
};

const STATUS_TONE: Record<CsvDiffEntry["status"], string> = {
  equal: "text-muted-foreground",
  added: "text-success",
  removed: "text-danger",
  modified: "text-warning",
};

const CELL = "border-b border-border/40 px-3 align-middle text-xs";

const fileNameOf = (path: string) => path.split(/[\\/]/).pop() || path;

const lineRange = (start: number | null, count: number) =>
  start == null
    ? "—"
    : count > 1
      ? `${start}–${start + count - 1}`
      : String(start);

function RowGutter({ entry }: { entry: CsvDiffEntry }) {
  const showLines = entry.status !== "equal";
  return (
    <td className="border-b border-r border-border/60 bg-muted/40 px-2 py-2 align-middle">
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={cn(
            "w-3 shrink-0 text-center font-mono text-[11px] leading-none",
            STATUS_TONE[entry.status],
          )}
        >
          {STATUS_MARK[entry.status]}
        </span>
        {showLines ? (
          <div className="flex flex-col gap-px">
            <span className="text-right font-mono text-[10px] leading-3 tabular-nums text-muted-foreground">
              {entry.left_line ?? "—"}
            </span>
            <span className="text-right font-mono text-[10px] leading-3 tabular-nums text-muted-foreground">
              {entry.right_line ?? "—"}
            </span>
          </div>
        ) : null}
      </div>
    </td>
  );
}

interface CsvDiffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDelimiter: string;
  initialFileA?: string;
}

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

  const headers = result
    ? Array.from(
        {
          length: Math.max(
            result.headers_left.length,
            result.headers_right.length,
          ),
        },
        (_, i) =>
          result.headers_left[i] ?? result.headers_right[i] ?? `#${i + 1}`,
      )
    : [];
  const keyCols = result?.key_cols ?? [];
  const dense = headers.length > DENSE_THRESHOLD;

  const renderRow = (entry: CsvDiffEntry, rowIdx: number) => {
    if (entry.status === "equal") {
      return (
        <tr key={`equal-${rowIdx}`}>
          <RowGutter entry={entry} />
          <td
            colSpan={Math.max(headers.length, 1)}
            className="border-b border-border/40 bg-muted/20 px-3 py-2"
          >
            <div className="flex items-baseline gap-2.5">
              <span className="text-[11px] text-muted-foreground">
                {entry.count} {t.equalRows}
              </span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                A {lineRange(entry.left_line, entry.count)} · B{" "}
                {lineRange(entry.right_line, entry.count)}
              </span>
            </div>
          </td>
        </tr>
      );
    }

    const changed = new Set(entry.changed_cols);
    const shownCols = Array.from(
      new Set([...keyCols, ...entry.changed_cols]),
    ).sort((a, b) => a - b);
    const left = entry.left_cells ?? [];
    const right = entry.right_cells ?? [];
    const isAdded = entry.status === "added";

    return (
      <tr key={`${entry.status}-${rowIdx}`}>
        <RowGutter entry={entry} />
        {headers.map((_, colIdx) => {
          if (entry.status === "modified") {
            const pos = shownCols.indexOf(colIdx);
            if (changed.has(colIdx)) {
              return (
                <td
                  key={colIdx}
                  className={cn(
                    CELL,
                    "bg-warning/5 py-2 shadow-[inset_2px_0_0_0_var(--warning)]",
                  )}
                >
                  <div className="truncate font-mono text-[11px] leading-[15px] tabular-nums text-muted-foreground">
                    {left[pos] ?? ""}
                  </div>
                  <div className="truncate text-xs font-medium leading-4 tabular-nums text-foreground">
                    {right[pos] ?? ""}
                  </div>
                </td>
              );
            }
            if (pos >= 0) {
              return (
                <td key={colIdx} className={cn(CELL, "py-2")}>
                  <div className="truncate text-foreground">
                    {left[pos] ?? ""}
                  </div>
                </td>
              );
            }
            return (
              <td key={colIdx} className={cn(CELL, "py-2")}>
                <div className="text-center text-[11px] text-muted-foreground/50">
                  ·
                </div>
              </td>
            );
          }

          return (
            <td
              key={colIdx}
              className={cn(
                CELL,
                "py-2",
                isAdded ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <div className="truncate">
                {(isAdded ? right : left)[colIdx] ?? ""}
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  const total = result?.entries.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = Math.min(page, totalPages - 1) * PAGE_SIZE;
  const visibleEntries = result
    ? result.entries.slice(pageStart, pageStart + PAGE_SIZE)
    : [];

  const legend = [
    {
      mark: STATUS_MARK.added,
      tone: STATUS_TONE.added,
      label: t.added,
      desc: t.csvDiffLegendAdded,
    },
    {
      mark: STATUS_MARK.removed,
      tone: STATUS_TONE.removed,
      label: t.removed,
      desc: t.csvDiffLegendRemoved,
    },
    {
      mark: STATUS_MARK.modified,
      tone: STATUS_TONE.modified,
      label: t.modify,
      desc: t.csvDiffLegendModified,
    },
    {
      mark: STATUS_MARK.equal,
      tone: STATUS_TONE.equal,
      label: t.equal,
      desc: t.csvDiffLegendEqual,
    },
  ];

  const stats = result
    ? [
        {
          mark: STATUS_MARK.added,
          tone: STATUS_TONE.added,
          label: t.added,
          value: result.added_count,
        },
        {
          mark: STATUS_MARK.removed,
          tone: STATUS_TONE.removed,
          label: t.removed,
          value: result.removed_count,
        },
        {
          mark: STATUS_MARK.modified,
          tone: STATUS_TONE.modified,
          label: t.modify,
          value: result.modified_count,
        },
        {
          mark: STATUS_MARK.equal,
          tone: STATUS_TONE.equal,
          label: t.equal,
          value: result.equal_count,
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
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
        className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex h-[52px] shrink-0 items-center border-b border-border/60 px-4">
          <h3 className="text-[13px] font-medium text-foreground">
            {t.csvDiff}
          </h3>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto h-7 w-7 text-muted-foreground"
            onClick={onClose}
            aria-label={t.close}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* File slots, delimiter and key columns */}
        <div className="shrink-0 border-b border-border/60 px-4 pt-3.5 pb-3">
          <div className="flex gap-2.5">
            {[
              {
                side: "A",
                file: fileA,
                placeholder: t.csvDiffFileAPlaceholder,
                browse: () => browseFile("a"),
              },
              {
                side: "B",
                file: fileB,
                placeholder: t.csvDiffFileBPlaceholder,
                browse: () => browseFile("b"),
              },
            ].map((slot) => (
              <div
                key={slot.side}
                className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border/70 bg-background px-2.5"
              >
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded border border-border/70 font-mono text-[10px] leading-none text-muted-foreground">
                  {slot.side}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-xs",
                      slot.file
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {slot.file ? fileNameOf(slot.file) : slot.placeholder}
                  </div>
                  {slot.file ? (
                    <div className="truncate font-mono text-[10px] leading-[14px] text-muted-foreground">
                      {slot.file}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 px-1.5 font-normal text-[11px] text-muted-foreground hover:text-primary"
                  onClick={slot.browse}
                >
                  {t.open}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-2.5 flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t.delimiter}
            </span>
            <div className="w-[104px] shrink-0">
              <Select
                value={delimiter}
                onChange={setDelimiter}
                options={[
                  { value: ",", label: t.splitComma },
                  { value: "\t", label: t.splitTab },
                  { value: ";", label: t.splitSemicolon },
                  { value: "|", label: t.splitPipe },
                ]}
                size="sm"
                ariaLabel={t.delimiter}
              />
            </div>
            <div className="mx-1 h-[18px] w-px shrink-0 bg-border" />
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t.keyColumns}
            </span>
            {headersA && headersA.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {headersA.map((h, i) => {
                  const selected = keyColumns.includes(i);
                  return (
                    <button
                      key={`kc-${i}`}
                      type="button"
                      onClick={() => toggleKeyColumn(i)}
                      className={cn(
                        "h-6 shrink-0 rounded-md border px-2 text-[11px] transition-colors",
                        selected
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {h || `#${i + 1}`}
                      {selected ? (
                        <span className="ml-1 opacity-70">×</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                {t.keyColumnsHint}
              </span>
            )}
            <Button
              size="sm"
              className="ml-auto shrink-0 gap-1.5"
              onClick={handleCompare}
              disabled={isComparing}
            >
              {isComparing && (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              )}
              {t.compare}
            </Button>
          </div>
        </div>

        {error && (
          <div className="shrink-0 border-b border-border/60 px-4 py-2 text-[11px] text-danger">
            {error}
          </div>
        )}

        {result && (
          <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border/60 px-4">
            {stats.map((stat) => (
              <span
                key={stat.label}
                className="inline-flex items-baseline gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className={cn("font-mono text-xs leading-none", stat.tone)}
                >
                  {stat.mark}
                </span>
                {stat.label}
                <span className="font-mono text-[11px] tabular-nums text-foreground">
                  {stat.value.toLocaleString()}
                </span>
              </span>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {result.modified_count > 0 && (
                <span className="mr-2.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="font-mono text-xs leading-none text-muted-foreground">
                    ·
                  </span>
                  {t.csvDiffUnchanged}
                </span>
              )}
              {totalPages > 1 && (
                <>
                  <span className="mr-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, total)} /{" "}
                    {total.toLocaleString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    aria-label={t.prev}
                    title={t.prev}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    aria-label={t.next}
                    title={t.next}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {result && headers.length > 0 ? (
          <ScrollArea
            className="min-h-0 flex-1"
            type="always"
            hideHorizontalScrollbar={!dense}
          >
            <table
              className="w-full border-collapse"
              style={{
                tableLayout: "fixed",
                ...(dense
                  ? {
                      minWidth: GUTTER_WIDTH + headers.length * DENSE_COL_WIDTH,
                    }
                  : {}),
              }}
            >
              <colgroup>
                <col style={{ width: GUTTER_WIDTH }} />
                {headers.map((header, i) => (
                  <col
                    key={`col-${i}-${header}`}
                    style={{
                      width: dense
                        ? DENSE_COL_WIDTH
                        : `calc((100% - ${GUTTER_WIDTH}px) / ${headers.length})`,
                    }}
                  />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-[1] bg-card">
                <tr>
                  <th className="h-9 border-b border-r border-border/60 bg-muted px-2 text-right align-middle font-mono text-[10px] font-normal text-muted-foreground">
                    #
                  </th>
                  {headers.map((header, i) => (
                    <th
                      key={`th-${i}`}
                      className="h-9 border-b border-border/60 px-3 text-left align-middle text-[11px] font-medium text-muted-foreground"
                    >
                      <div className="truncate">{header}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{visibleEntries.map(renderRow)}</tbody>
            </table>
          </ScrollArea>
        ) : result ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-muted-foreground">{t.csvDiffNoResult}</p>
          </div>
        ) : isComparing ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-muted-foreground">{t.comparing}</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-6">
            <div className="w-[560px] max-w-full rounded-lg border border-border/70 bg-background px-4">
              {legend.map((item) => (
                <div
                  key={item.label}
                  className="flex h-[30px] items-center gap-3 border-b border-border/40 last:border-b-0"
                >
                  <span
                    className={cn(
                      "w-3 shrink-0 text-center font-mono text-[11px] leading-none",
                      item.tone,
                    )}
                  >
                    {item.mark}
                  </span>
                  <span className="w-8 shrink-0 text-[11px] text-foreground">
                    {item.label}
                  </span>
                  <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
            <div className="max-w-[540px] text-center">
              <p className="text-[13px] font-medium text-foreground">
                {t.csvDiffEmptyTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {fileA && fileB ? t.csvDiffEmptyBody : t.csvDiffNoResult}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
