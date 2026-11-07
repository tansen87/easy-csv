import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { CircleAlert, RotateCw, Search, SearchX, X } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Tooltip } from "@/components/ui/Tooltip";
import { useLanguage } from "@/i18n";
import { DataProfileRow } from "@/modules/data-preview/DataProfileRow";
import {
  buildProfileRows,
  fmtCount,
  parseXanStatsCsv,
  type ColumnStat,
} from "@/modules/data-preview/profileStats";

/**
 * Data profile side panel (design 042).
 *
 * The list answers one question per column: can I use it? Missing cells are the
 * only value that carries colour; everything else is a neutral step so the
 * completeness rulers line up and stay readable. Details are folded away until
 * a row is clicked, which keeps twelve columns on one screen instead of twelve
 * cards.
 */

type SortKey = "order" | "missing";

interface DataProfilePanelProps {
  filePath: string;
  delimiter: string;
  isVisible: boolean;
  onClose: () => void;
}

export const DataProfilePanel = React.memo(function DataProfilePanel({
  filePath,
  delimiter,
  isVisible,
  onClose,
}: DataProfilePanelProps) {
  const { t } = useLanguage();
  const [columns, setColumns] = useState<ColumnStat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("order");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  /** Set by the refresh button so the next load skips the on-disk cache. */
  const skipCacheRef = useRef(false);

  // A new file has different column names: drop stale filters and folds.
  useEffect(() => {
    setExpanded(new Set());
    setSearch("");
  }, [filePath, delimiter]);

  useEffect(() => {
    if (!isVisible || !filePath) return;

    let cancelled = false;
    const skipCache = skipCacheRef.current;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!skipCache) {
          const cached = await invoke<string | null>("load_profile_cache", {
            filePath,
            delimiter,
          });
          if (cancelled) return;
          if (cached) {
            setColumns(parseXanStatsCsv(cached));
            return;
          }
        }

        const raw = await invoke<string>("profile_csv", {
          filePath,
          delimiter,
        });
        if (cancelled) return;
        setColumns(parseXanStatsCsv(raw));

        await invoke("save_profile_cache", {
          filePath,
          delimiter,
          stats: raw,
        });
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        skipCacheRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [filePath, delimiter, isVisible, reloadKey]);

  const refresh = useCallback(() => {
    skipCacheRef.current = true;
    setReloadKey((key) => key + 1);
  }, []);

  const toggleRow = useCallback((field: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  const rows = useMemo(() => buildProfileRows(columns), [columns]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? rows.filter((row) => row.stat.field.toLowerCase().includes(query))
      : rows;
    return sort === "missing"
      ? [...filtered].sort((a, b) => b.missing - a.missing)
      : filtered;
  }, [rows, search, sort]);

  if (!isVisible) return null;

  const hasData = rows.length > 0;
  const missingColumns = rows.filter((row) => row.missing > 0).length;
  const meta =
    loading && !hasData
      ? t.profileLoading
      : hasData
        ? `${fmtCount(rows[0].total)} ${t.profileRowUnit} · ${rows.length} ${t.profileColumnUnit} · ${t.profileMissingColumns.replace("{count}", String(missingColumns))}`
        : null;

  return (
    <div
      className="flex h-full flex-col"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex flex-none items-start gap-1 pt-[13px] pr-2.5 pb-2.5 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] leading-[18px] font-medium">
            {t.dataProfile}
          </h2>
          {meta && (
            <div className="mt-[3px] truncate text-[11px] leading-[15px] tabular-nums text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        <Tooltip content={t.profileRefresh}>
          <button
            type="button"
            onClick={refresh}
            disabled={loading || !filePath}
            aria-label={t.profileRefresh}
            className="grid h-[26px] w-[26px] place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <Tooltip content={t.close}>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="grid h-[26px] w-[26px] place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>

      {hasData && (
        <>
          <div className="flex-none px-4 pb-2">
            <label className="flex h-7 items-center gap-[7px] rounded-[7px] border border-border bg-background px-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
              <Search className="h-[13px] w-[13px] shrink-0 text-muted-foreground/60" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.searchColumns}
                className="min-w-0 flex-1 border-0 bg-transparent text-[11.5px] outline-none placeholder:text-muted-foreground/60"
              />
            </label>
          </div>

          <div className="flex flex-none items-center justify-between gap-2 pr-3 pb-2 pl-4">
            <span className="text-[10.5px] tabular-nums text-muted-foreground">
              {search ? (
                <>
                  <b className="font-medium text-foreground">
                    {visibleRows.length}
                  </b>{" "}
                  / {rows.length} {t.profileColumnUnit}
                </>
              ) : (
                <>
                  <b className="font-medium text-foreground">{rows.length}</b>{" "}
                  {t.profileColumnUnit}
                </>
              )}
            </span>
            <div className="flex gap-px rounded-md border border-border/60 p-px">
              {(["order", "missing"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  aria-pressed={sort === key}
                  className={
                    sort === key
                      ? "h-5 rounded-[5px] bg-muted px-[7px] text-[10.5px] font-medium text-foreground transition-colors"
                      : "h-5 rounded-[5px] px-[7px] text-[10.5px] text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {key === "order" ? t.profileSortOrder : t.profileSortMissing}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error ? (
        <div className="flex-1 px-5 pt-10 text-center">
          <CircleAlert
            className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60"
            strokeWidth={1.4}
          />
          <h3 className="text-[12.5px] font-medium">{t.profileErrorTitle}</h3>
          <p className="mt-1.5 text-[11.5px] leading-[17px] text-muted-foreground">
            {t.profileErrorHint}
          </p>
          <pre className="mt-3.5 max-h-[58px] overflow-hidden rounded-md border border-border bg-muted px-2.5 py-2 text-left font-mono text-[10px] leading-4 break-words whitespace-pre-wrap text-muted-foreground">
            {error}
          </pre>
          <button
            type="button"
            onClick={refresh}
            className="mt-3.5 h-7 rounded-md border border-border bg-card px-3 text-[11.5px] font-medium transition-colors hover:bg-muted"
          >
            {t.profileRetry}
          </button>
        </div>
      ) : !hasData ? (
        loading ? (
          <div className="flex-1" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="px-4 pt-[9px] pb-[11px] opacity-60">
                <div className="h-2.5 w-[74px] rounded-sm bg-muted" />
                <div className="mt-[9px] flex items-center gap-[9px]">
                  <span className="h-2 w-[22px] rounded-sm bg-muted" />
                  <span className="h-1 flex-1 bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 px-5 pt-12 text-center">
            <p className="text-[11.5px] leading-[17px] text-muted-foreground">
              {t.dataProfileRequiresInput}
            </p>
          </div>
        )
      ) : visibleRows.length === 0 ? (
        <div className="flex-1 px-5 pt-12 text-center">
          <SearchX
            className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60"
            strokeWidth={1.4}
          />
          <h3 className="text-[12.5px] font-medium">
            {t.profileNoMatch.replace("{query}", search.trim())}
          </h3>
          <p className="mt-1.5 text-[11.5px] leading-[17px] text-muted-foreground">
            {t.profileNoMatchHint.replace("{count}", String(rows.length))}
          </p>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-3 text-[11.5px] text-primary hover:underline"
          >
            {t.profileClearSearch}
          </button>
        </div>
      ) : (
        <ScrollArea className="flex-1" blockContent hideHorizontalScrollbar>
          <div className="pb-3.5">
            {visibleRows.map((row) => (
              <DataProfileRow
                key={row.stat.field}
                row={row}
                open={expanded.has(row.stat.field)}
                onToggle={toggleRow}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
});
