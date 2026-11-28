import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { RunTimer } from "@/components/ui/RunTimer";
import { useLanguage } from "@/i18n";
import { useToolRun } from "@/hooks/useToolRuns";
import { cn } from "@/lib/utils";
import { formatElapsed } from "@/utils/format";

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
  /** Report a finished run when the dialog was closed while it ran. */
  onShowToast?: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

export function CsvDiffDialog({
  isOpen,
  onClose,
  defaultDelimiter,
  initialFileA,
  onShowToast,
}: CsvDiffDialogProps) {
  const { t } = useLanguage();
  const [fileA, setFileA] = useState("");
  const [fileB, setFileB] = useState("");
  const [delimiter, setDelimiter] = useState(defaultDelimiter || ",");
  const [headersA, setHeadersA] = useState<string[] | null>(null);
  const [keyColumns, setKeyColumns] = useState<number[]>([]);
  const [result, setResult] = useState<CsvDiffResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [isComparing, setIsComparing] = useState(false);
  const { begin, end, running } = useToolRun("csvDiff");
  /** This dialog started it, or a previous run outlived the dialog. */
  const busy = isComparing || running;
  const [error, setError] = useState<string | null>(null);
  /** Design 085 · D: settings live in a popover, not in a permanent toolbar. */
  const [editing, setEditing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  /** Latest `isOpen` for an in-flight compare: a closed dialog still finishes. */
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    if (isOpen) {
      setFileA(initialFileA || "");
      setFileB("");
      setResult(null);
      setElapsedMs(null);
      setError(null);
      setDelimiter(defaultDelimiter || ",");
      setKeyColumns([]);
      setPage(0);
      setEditing(false);
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
      if (e.key !== "Escape") return;
      // The settings popover is the innermost surface: its Escape closes it and
      // nothing else.
      if (editing) {
        setEditing(false);
        return;
      }
      // Design 085: this is a workspace view, not a modal - the menu bar stays
      // live above it. A menu or a dialog opened from that bar owns Escape;
      // closing both at once would be a surprise.
      if (document.querySelector('[role="menu"], [role="dialog"]')) return;
      onClose();
    },
    [editing, onClose],
  );

  // A click anywhere outside the popover (or its triggers) puts it away; the
  // table behind stays usable, so this is not a backdrop.
  useEffect(() => {
    if (!isOpen || !editing) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (popoverRef.current?.contains(target)) return;
      if (target?.closest("[data-diff-edit]")) return;
      setEditing(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isOpen, editing]);

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
    if (busy) return;
    if (!fileA || !fileB) {
      setError(t.csvDiffSelectBoth);
      return;
    }
    begin();
    setIsComparing(true);
    setError(null);
    setElapsedMs(null);
    const startedAt = performance.now();
    try {
      const data = await invoke<CsvDiffResult>("diff_csv_files", {
        fileA,
        fileB,
        delimiterA: delimiter,
        delimiterB: delimiter,
        keyColumns: keyColumns.length ? keyColumns : null,
      });
      setResult(data);
      setElapsedMs(performance.now() - startedAt);
      setPage(0);
      setEditing(false);
      if (!isOpenRef.current) {
        onShowToast?.(`${t.toolFinished}: ${t.csvDiff}`, "success");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      end();
      setIsComparing(false);
    }
  }, [fileA, fileB, delimiter, keyColumns, t, begin, end, busy, onShowToast]);

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

  /** Names of the columns used as keys, for the one-line summary. */
  const keyColumnNames =
    headersA && keyColumns.length > 0
      ? keyColumns
          .map((i) => headersA[i])
          .filter((name): name is string => Boolean(name))
          .join(" · ")
      : "";

  const renderKeyColumnChips = (chipsClassName: string) =>
    headersA && headersA.length > 0 ? (
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5",
          chipsClassName,
        )}
      >
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
              {selected ? <span className="ml-1 opacity-70">×</span> : null}
            </button>
          );
        })}
      </div>
    ) : (
      <span className="min-w-0 truncate text-[11px] text-muted-foreground">
        {t.keyColumnsHint}
      </span>
    );

  const renderDelimiter = () => (
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
  );

  const renderFileRow = (
    side: "a" | "b",
    file: string,
    placeholder: string,
  ) => (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded border border-border/70 font-mono text-[10px] leading-none text-muted-foreground">
        {side.toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-xs",
            file ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {file ? fileNameOf(file) : placeholder}
        </div>
        {file ? (
          <div className="truncate font-mono text-[10px] leading-[14px] text-muted-foreground">
            {file}
          </div>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="xs"
        className="shrink-0 px-1.5 font-normal text-[11px] text-muted-foreground hover:text-primary"
        onClick={() => void browseFile(side)}
      >
        {t.open}
      </Button>
    </div>
  );

  const closeButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-7 w-7 shrink-0 text-muted-foreground"
      onClick={onClose}
      aria-label={t.close}
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    // Design 085 · D: a workspace view, not an overlay. It starts where the menu
    // bar ends and stays under the chrome layer, so the bar keeps working above
    // it. There is no permanent toolbar: before the first compare the empty
    // state *is* the settings form, and afterwards the top collapses to a
    // single readable sentence.
    <div
      ref={dialogRef}
      role="region"
      aria-label={t.csvDiff}
      tabIndex={-1}
      className="absolute inset-x-0 top-9 bottom-0 z-floating flex flex-col overflow-hidden bg-card outline-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {result ? (
        <>
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 pr-1.5 pl-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                data-diff-edit
                title={fileA}
                onClick={() => setEditing(true)}
                className="flex min-w-0 max-w-[230px] items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted"
              >
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded border border-border/70 font-mono text-[10px] leading-none text-muted-foreground">
                  A
                </span>
                <span className="truncate text-xs font-medium">
                  {fileNameOf(fileA)}
                </span>
              </button>
              <span className="shrink-0 text-[11px] text-muted-foreground/60">
                ↔
              </span>
              <button
                type="button"
                data-diff-edit
                title={fileB}
                onClick={() => setEditing(true)}
                className="flex min-w-0 max-w-[230px] items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted"
              >
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded border border-border/70 font-mono text-[10px] leading-none text-muted-foreground">
                  B
                </span>
                <span className="truncate text-xs font-medium">
                  {fileNameOf(fileB)}
                </span>
              </button>
              <span className="mx-0.5 h-3.5 w-px shrink-0 bg-border" />
              <button
                type="button"
                data-diff-edit
                onClick={() => setEditing(true)}
                className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="shrink-0">{t.keyColumns}</span>
                <span className="truncate text-foreground/80">
                  {keyColumnNames || "—"}
                </span>
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {stats.map((stat) => (
                <span
                  key={stat.label}
                  className="inline-flex items-baseline gap-1 text-[11px] text-muted-foreground"
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
              {elapsedMs !== null && (
                <span className="hidden font-mono text-[10px] text-muted-foreground/80 min-[1080px]:inline">
                  {formatElapsed(elapsedMs)}
                </span>
              )}
              {totalPages > 1 && (
                <div className="flex items-center gap-0.5">
                  <span className="mr-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {pageStart + 1}–
                    {Math.min(pageStart + PAGE_SIZE, total)} /{" "}
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
                </div>
              )}
              <button
                type="button"
                data-diff-edit
                onClick={() => setEditing(true)}
                aria-expanded={editing}
                className="h-6 shrink-0 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t.csvDiffEdit}
              </button>
              {closeButton}
            </div>
          </div>

          {error && !editing && (
            <div className="shrink-0 border-b border-border/60 px-4 py-2 text-[11px] text-danger">
              {error}
            </div>
          )}

          {headers.length > 0 ? (
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
                        minWidth:
                          GUTTER_WIDTH + headers.length * DENSE_COL_WIDTH,
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
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-xs text-muted-foreground">
                {t.csvDiffNoResult}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="absolute top-2.5 right-2.5 z-10">{closeButton}</div>
          <div className="flex flex-1 overflow-y-auto px-6 py-6">
            <div className="m-auto w-[680px] max-w-full">
              <h2 className="text-[15px] font-medium text-foreground">
                {t.csvDiff}
              </h2>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {t.csvDiffEmptyBody}
              </p>

              <div className="mt-5 flex min-w-0 items-center gap-2.5">
                {(["a", "b"] as const).map((side) => {
                  const file = side === "a" ? fileA : fileB;
                  const placeholder =
                    side === "a"
                      ? t.csvDiffFileAPlaceholder
                      : t.csvDiffFileBPlaceholder;
                  return (
                    <div
                      key={side}
                      className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border/70 bg-background px-2.5"
                    >
                      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded border border-border/70 font-mono text-[10px] leading-none text-muted-foreground">
                        {side.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "truncate text-xs",
                            file
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {file ? fileNameOf(file) : placeholder}
                        </div>
                        {file ? (
                          <div className="truncate font-mono text-[10px] leading-[14px] text-muted-foreground">
                            {file}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="shrink-0 px-1.5 font-normal text-[11px] text-muted-foreground hover:text-primary"
                        onClick={() => void browseFile(side)}
                      >
                        {t.open}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2.5">
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {t.delimiter}
                </span>
                <div className="w-[104px] shrink-0">{renderDelimiter()}</div>
                <div className="mx-1 h-[18px] w-px shrink-0 bg-border" />
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {t.keyColumns}
                </span>
                {renderKeyColumnChips("flex-wrap")}
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {isComparing && <RunTimer running={isComparing} />}
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleCompare}
                    disabled={busy}
                  >
                    {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    {t.compare}
                  </Button>
                </div>
              </div>

              {error && (
                <p className="mt-2 text-[11px] text-danger">{error}</p>
              )}

              <div className="mt-6 border-t border-border/60 pt-1">
                {legend.map((item) => (
                  <div
                    key={item.label}
                    className="flex h-[26px] items-center gap-3"
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
            </div>
          </div>
        </>
      )}

      {result && editing && (
        <div
          ref={popoverRef}
          className="absolute top-10 left-4 z-10 w-[520px] max-w-[calc(100%-32px)] rounded-[10px] border border-border bg-card p-3 shadow-[0_8px_24px_oklch(0.2_0.02_80_/_12%)]"
        >
          {renderFileRow("a", fileA, t.csvDiffFileAPlaceholder)}
          <div className="mt-2">
            {renderFileRow("b", fileB, t.csvDiffFileBPlaceholder)}
          </div>
          <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t.delimiter}
            </span>
            <div className="w-[104px] shrink-0">{renderDelimiter()}</div>
            <div className="mx-1 h-[18px] w-px shrink-0 bg-border" />
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t.keyColumns}
            </span>
            {renderKeyColumnChips("max-h-24 flex-wrap overflow-y-auto")}
          </div>
          {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}
          <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5">
            <span className="min-w-0 truncate text-[11px] text-muted-foreground/80">
              {t.keyColumnsHint}
            </span>
            <Button
              size="sm"
              className="ml-auto shrink-0 gap-1.5"
              onClick={handleCompare}
              disabled={busy}
            >
              {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {t.compare}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
