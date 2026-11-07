import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, MoreHorizontal, Search, X } from "lucide-react";
import { useLanguage } from "@/i18n";
import { StepLineage } from "@/types/xan";
import { Tooltip } from "@/components/ui/Tooltip";
import { LineageColumnPath } from "@/modules/pipeline/panels/LineageColumnPath";
import { LineageFullscreen } from "@/modules/pipeline/panels/LineageFullscreen";
import {
  ColumnRow,
  GroupLabel,
} from "@/modules/pipeline/panels/LineageColumnRow";
import {
  StepChange,
  buildColumnTrace,
  summarizeColumns,
  summarizeSteps,
} from "@/modules/pipeline/panels/lib/columnLineage";

interface DataLineagePanelProps {
  lineageData: StepLineage[];
  onSaveLineage: () => void;
  onClose: () => void;
}

/**
 * 数据血缘面板（设计 045）。
 *
 * 320px 放不下一张节点图，所以这里只做两件事：按列列出这次执行的结果，
 * 以及某一列从源到结果的路径。整张图在全屏泳道图里看。
 */
export function DataLineagePanel({
  lineageData,
  onSaveLineage,
  onClose,
}: DataLineagePanelProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => summarizeColumns(lineageData), [lineageData]);
  const changes = useMemo(() => summarizeSteps(lineageData), [lineageData]);

  const trace = useMemo(
    () => (openColumn ? buildColumnTrace(lineageData, openColumn) : null),
    [lineageData, openColumn],
  );
  // 重新执行后这一列可能已经不存在，此时不能让行保持展开
  const activeColumn = trace ? openColumn : null;

  const keyword = query.trim().toLowerCase();
  const matchName = useCallback(
    (name: string) => !keyword || name.toLowerCase().includes(keyword),
    [keyword],
  );
  const resultColumns = groups.result.filter((c) => matchName(c.name));
  const removedColumns = groups.removed.filter((c) => matchName(c.name));

  const lastStep = lineageData[lineageData.length - 1];
  const firstStep = lineageData[0];
  const totalIn = firstStep?.inputRowCount ?? 0;
  const totalOut = lastStep?.outputRowCount ?? 0;
  const resultColumnCount = lastStep?.outputSchema.length ?? 0;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
      } else if (fullscreen) {
        setFullscreen(false);
      } else if (openColumn) {
        setOpenColumn(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, openColumn, menuOpen]);

  const toggleColumn = (name: string) => {
    setOpenColumn((current) => (current === name ? null : name));
  };

  const handleBodyKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(
      bodyRef.current?.querySelectorAll<HTMLElement>("[data-lineage-row]") ?? [],
    );
    if (rows.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const index = active ? rows.indexOf(active) : -1;
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(rows.length - 1, index + 1)
        : Math.max(0, index - 1);
    if (nextIndex === index) return;
    event.preventDefault();
    rows[nextIndex]?.focus();
  };

  const changeValue = (change: StepChange) => {
    if (change.rowCountIn !== change.rowCountOut) {
      return `${change.rowCountIn} → ${change.rowCountOut} ${t.lineageRowsUnit}`;
    }
    const parts: string[] = [];
    if (change.diff.cast.length > 0) {
      parts.push(
        `${t.lineageCast} ${change.diff.cast.length} ${t.lineageColumnsUnit}`,
      );
    }
    if (change.diff.renamed.length > 0) {
      parts.push(
        `${t.lineageRenamed} ${change.diff.renamed.length} ${t.lineageColumnsUnit}`,
      );
    }
    if (change.diff.added.length > 0) parts.push(`+${change.diff.added.length}`);
    if (change.diff.removed.length > 0) {
      parts.push(`−${change.diff.removed.length}`);
    }
    return parts.join(" · ");
  };

  if (fullscreen) {
    return (
      <LineageFullscreen
        lineageData={lineageData}
        tracedColumn={activeColumn}
        onTrace={setOpenColumn}
        onClose={() => setFullscreen(false)}
        onSave={onSaveLineage}
      />
    );
  }

  const isEmpty = lineageData.length === 0;
  const noMatch =
    !isEmpty && resultColumns.length === 0 && removedColumns.length === 0;

  return (
    <div
      className="flex h-full flex-col bg-card"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex-none px-4 pt-3">
        <div className="flex h-7 items-center gap-2">
          <h3 className="text-[13px] font-medium">{t.dataLineage}</h3>
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip content={t.lineageFullscreen}>
              <button
                type="button"
                aria-label={t.lineageFullscreen}
                disabled={isEmpty}
                onClick={() => setFullscreen(true)}
                className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Maximize2 className="h-[13px] w-[13px]" />
              </button>
            </Tooltip>
            <div className="relative" ref={menuRef}>
              <Tooltip content={t.lineageMore}>
                <button
                  type="button"
                  aria-label={t.lineageMore}
                  aria-expanded={menuOpen}
                  disabled={isEmpty}
                  onClick={() => setMenuOpen((open) => !open)}
                  className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <MoreHorizontal className="h-[13px] w-[13px]" />
                </button>
              </Tooltip>
              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-md">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSaveLineage();
                    }}
                    className="flex h-[26px] w-full items-center rounded-md px-2 text-left text-[11.5px] text-popover-foreground transition-colors hover:bg-muted"
                  >
                    {t.lineageExportJson}
                  </button>
                </div>
              )}
            </div>
            <Tooltip content={t.lineageClose}>
              <button
                type="button"
                aria-label={t.lineageClose}
                onClick={onClose}
                className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {!isEmpty && (
          <div className="relative mt-2.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchColumns}
              className="h-8 w-full rounded-lg border border-border bg-card pl-7 pr-7 text-[12px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-primary focus:shadow-[0_0_0_2px_var(--brand-soft)]"
            />
            {query && (
              <button
                type="button"
                aria-label={t.lineageClearSearch}
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        ref={bodyRef}
        onKeyDown={handleBodyKeyDown}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {isEmpty && <LineageEmptyState />}

        {noMatch && (
          <div className="px-5 py-6">
            <h4 className="text-[12.5px] font-medium">
              {t.lineageNoMatchTitle.replace("{query}", query.trim())}
            </h4>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {t.lineageNoMatchDesc}
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-3 text-[10.5px] text-primary underline decoration-primary/35 underline-offset-2"
            >
              {t.lineageClearSearch}
            </button>
          </div>
        )}

        {!isEmpty && resultColumns.length > 0 && (
          <>
            <GroupLabel
              label={t.lineageGroupResult}
              count={groups.result.length}
            />
            {resultColumns.map((column) => (
              <ColumnRow
                key={column.name}
                column={column}
                open={activeColumn === column.name}
                onToggle={() => toggleColumn(column.name)}
              />
            ))}
          </>
        )}

        {!isEmpty && removedColumns.length > 0 && (
          <>
            <GroupLabel
              label={t.lineageGroupRemoved}
              count={groups.removed.length}
            />
            {removedColumns.map((column) => (
              <ColumnRow
                key={column.name}
                column={column}
                open={activeColumn === column.name}
                onToggle={() => toggleColumn(column.name)}
              />
            ))}
          </>
        )}

        {trace && activeColumn && (
          <LineageColumnPath
            trace={trace}
            resultRows={totalOut}
            resultColumns={resultColumnCount}
            onOpenGraph={() => setFullscreen(true)}
          />
        )}

        {!isEmpty && !activeColumn && changes.length > 0 && (
          <>
            <GroupLabel
              label={t.lineageGroupChanges}
              count={changes.length}
            />
            {changes.map((change) => (
              <div
                key={change.stepId}
                className="grid h-[34px] grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 px-4 text-[11.5px]"
              >
                <span className="font-mono text-[9.5px] text-muted-foreground/60">
                  {String(change.index).padStart(2, "0")}
                </span>
                <span className="truncate" title={change.commandName}>
                  {change.alias || change.commandName}
                </span>
                <span className="whitespace-nowrap font-mono text-[9.5px] tabular-nums text-muted-foreground">
                  {changeValue(change)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {!isEmpty && (
        <div className="flex h-9 flex-none items-center gap-1.5 border-t border-border/60 px-4 text-[10.5px] tabular-nums text-muted-foreground">
          <span>
            {lineageData.length} {t.lineageStepsUnit}
          </span>
          <span className="opacity-60">·</span>
          <span>
            {totalIn} → {totalOut} {t.lineageRowsUnit}
          </span>
          <span className="ml-auto">{t.lineageLatestRun}</span>
        </div>
      )}
    </div>
  );
}

function LineageEmptyState() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col justify-center px-5 pb-12">
      <h4 className="text-[12.5px] font-medium">{t.lineageEmptyTitle}</h4>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {t.lineageEmptyDesc}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {t.lineageEmptyOverwrite}
      </p>
      <div className="mt-4 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/60">
        <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
        {t.lineageEmptyWait}
      </div>
    </div>
  );
}
