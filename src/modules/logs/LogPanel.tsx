import {
  ArrowDown,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FolderOpen,
  History,
  Maximize2,
  Minimize2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { LogEntry, PanelDockState } from "@/types/xan";
import { useLanguage } from "@/i18n";
import {
  APP_GROUP_KEY,
  LevelFilter,
  LogRunGroup,
  TabScope,
  buildLogGroups,
  filterLogs,
  highlightMessage,
  levelTotals,
} from "@/modules/logs/lib/logGroups";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  onRemoveLog: (id: string) => void;
  isVisible: boolean;
  onClose: () => void;
  onShowHistory?: () => void;
  /** Export the currently visible (filtered) lines; text is prebuilt here. */
  onExport?: (text: string) => void;
  /** Open `data/logs/` in the system file manager. */
  onOpenLogsDir?: () => void;
  /** Re-run the pipeline that produced a run group. */
  onRerun?: (tabId: string) => void;
  /** Persisted drawer height (docked drawer). */
  dockState?: PanelDockState;
  /** Report height changes for persistence. */
  onDockChange?: (patch: Partial<PanelDockState>) => void;
  /** Current tab, for the 「仅当前标签页」 log scope. */
  selectedTabId?: string;
  /** Tab id → name, used for the group headers. */
  tabs?: { id: string; name: string }[];
  /**
   * Pixels to keep free at the window's right edge (AI panel + view dock,
   * design 076). Without it the drawer slid underneath the docked panels.
   */
  rightInset?: number;
}

/** Severity dot, the only place colour appears in the list. */
const LOG_DOT_CLASS: Record<LogEntry["type"], string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
};

/** Rail node: worst severity of the run — stroke (and fill) carry the colour. */
const RAIL_NODE_CLASS: Record<LogRunGroup["status"], string> = {
  info: "border-muted-foreground/60",
  success: "border-success bg-success/20",
  warning: "border-warning bg-warning/20",
  error: "border-danger bg-danger/20",
};

const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 160;
/** Height of the window's menu bar (`.app-header` is `h-9`). */
const APP_HEADER_HEIGHT = 36;
/**
 * The docked drawer must never grow past this: the header plus a breath, so a
 * dragged-to-max drawer still reads as a drawer and not as a broken full screen.
 * Distinct from `APP_HEADER_HEIGHT`, which is where the maximized surface starts.
 */
const TITLEBAR_HEIGHT = 56;

const pad2 = (value: number) => String(value).padStart(2, "0");

/** `HH:mm:ss` — full date only matters for the disk backfill separators. */
function formatLineTime(ts: Date): string {
  return `${pad2(ts.getHours())}:${pad2(ts.getMinutes())}:${pad2(ts.getSeconds())}`;
}

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Docked bottom drawer (design 071): one execution run = one collapsible
 * group; level chips + tab scope + free-text search all AND-combine. Lines
 * backfilled from disk are read-only; the files themselves are pruned by the
 * retention setting, so the drawer never manages files by hand.
 */
export const LogPanel = React.memo(function LogPanel({
  logs,
  onClear,
  onRemoveLog,
  isVisible,
  onClose,
  onShowHistory,
  onExport,
  onOpenLogsDir,
  onRerun,
  dockState,
  onDockChange,
  selectedTabId,
  tabs,
  rightInset = 0,
}: LogPanelProps) {
  const { t } = useLanguage();
  const [isMaximized, setIsMaximized] = useState(false);
  const [height, setHeight] = useState(
    dockState?.height && dockState.height >= MIN_HEIGHT
      ? dockState.height
      : DEFAULT_HEIGHT,
  );
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [copiedGroupKey, setCopiedGroupKey] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<LevelFilter>("all");
  const [tabScope, setTabScope] = useState<TabScope>("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  /** Whether the newest run (rendered at the bottom) is in view. */
  const [atLatest, setAtLatest] = useState(true);
  /** 1-based position shown in the search box (unslop 071-02: "1/3"). */
  const [hitIndex, setHitIndex] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<number | null>(null);
  const groupCopyTimerRef = useRef<number | null>(null);
  const hitIndexRef = useRef(0);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );

  const tabNameById = useMemo(
    () => new Map((tabs ?? []).map((tab) => [tab.id, tab.name])),
    [tabs],
  );

  const totals = useMemo(() => levelTotals(logs), [logs]);

  useEffect(() => {
    hitIndexRef.current = 0;
    setHitIndex(0);
  }, [query]);

  const filtered = useMemo(
    () => filterLogs(logs, activeFilter, tabScope, selectedTabId, query),
    [logs, activeFilter, tabScope, selectedTabId, query],
  );

  /** Lines with at least one search hit — drives the "1/3" box indicator. */
  const hitTotal = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);
    if (terms.length === 0) return 0;
    return filtered.filter((log) => {
      const message = log.message.toLowerCase();
      return terms.every((term) => message.includes(term));
    }).length;
  }, [filtered, query]);

  const groups = useMemo(
    () => buildLogGroups(filtered, tabNameById, t.logGroupApp),
    [filtered, tabNameById, t.logGroupApp],
  );

  /** Plain-text export of exactly what the user sees (design 071 §2.5). */
  const exportText = useMemo(
    () =>
      filtered
        .map(
          (log) =>
            `${log.timestamp.toLocaleString()} [${log.type}] ${log.message}`,
        )
        .join("\n"),
    [filtered],
  );

  const getViewport = () =>
    scrollAreaRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );

  const copyText = useCallback(async (text: string, marker: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(textarea);
    }
    setCopiedLogId(marker);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedLogId(null), 3000);
  }, []);

  const copyGroup = useCallback(
    (group: LogRunGroup) => {
      const text = group.entries
        .map((log) => `[${formatLineTime(log.timestamp)}] ${log.message}`)
        .join("\n");
      setCopiedGroupKey(group.key);
      if (groupCopyTimerRef.current)
        window.clearTimeout(groupCopyTimerRef.current);
      groupCopyTimerRef.current = window.setTimeout(
        () => setCopiedGroupKey(null),
        3000,
      );
      void copyText(text, group.key);
    },
    [copyText],
  );

  /**
   * The timeline runs top → bottom in time order, so the latest execution sits
   * at the bottom edge — 「最新」 means `scrollTop = scrollHeight`.
   */
  const jumpToLatest = useCallback(() => {
    const viewport = getViewport();
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    setAtLatest(true);
  }, []);

  const handleViewportScroll = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const nearBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 40;
    setAtLatest(nearBottom);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const viewport = getViewport();
    if (!viewport) return;
    viewport.addEventListener("scroll", handleViewportScroll);
    return () => viewport.removeEventListener("scroll", handleViewportScroll);
  }, [isVisible, handleViewportScroll]);

  /**
   * Bumps whenever a line is added (or the set is replaced) — the follow
   * effect keys off it so a 500-line rotating buffer still pulls the view up
   * when the length happens to stay constant.
   */
  const latestMarker = useMemo(() => {
    let latest = 0;
    for (const log of logs) latest = Math.max(latest, log.timestamp.getTime());
    return `${logs.length}:${latest}`;
  }, [logs]);

  // Follow the newest run while the user stays at the bottom of the drawer.
  useEffect(() => {
    if (!isVisible || !atLatest) return;
    const viewport = getViewport();
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [isVisible, latestMarker, atLatest]);

  // Reopening the drawer starts at the newest run, so a stale "scrolled away"
  // flag must not show the jump button; the effect above lands on the bottom.
  useEffect(() => {
    if (isVisible) setAtLatest(true);
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      if (groupCopyTimerRef.current)
        window.clearTimeout(groupCopyTimerRef.current);
    };
  }, []);

  // Clamp the persisted height when the window shrinks.
  useLayoutEffect(() => {
    if (!isVisible || isMaximized) return;
    const max = Math.max(MIN_HEIGHT, window.innerHeight - TITLEBAR_HEIGHT);
    setHeight((h) => Math.min(h, max));
  }, [isVisible, isMaximized]);

  // Publish the rendered height so canvas overlays anchored to the bottom (the
  // status line in `FlowPanel`) ride above the drawer, including mid-drag.
  // `0` while hidden or maximized - a maximized drawer already covers the canvas.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--log-drawer-height",
      `${isVisible && !isMaximized ? height : 0}px`,
    );
    return () => {
      root.style.removeProperty("--log-drawer-height");
    };
  }, [isVisible, isMaximized, height]);

  /** Top-edge drag: up grows, down shrinks. Persisted on release. */
  const handleResizeStart = (e: React.PointerEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: height };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    const handleMove = (ev: PointerEvent) => {
      const start = resizeRef.current;
      if (!start) return;
      const max = Math.max(MIN_HEIGHT, window.innerHeight - TITLEBAR_HEIGHT);
      const next = Math.max(
        MIN_HEIGHT,
        Math.min(start.startHeight + (start.startY - ev.clientY), max),
      );
      setHeight(next);
    };
    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const start = resizeRef.current;
      resizeRef.current = null;
      if (!start) return;
      const max = Math.max(MIN_HEIGHT, window.innerHeight - TITLEBAR_HEIGHT);
      const final = Math.max(
        MIN_HEIGHT,
        Math.min(start.startHeight + (start.startY - ev.clientY), max),
      );
      onDockChange?.({ height: final });
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  /** Enter cycles the search hits; Esc clears the query before closing. */
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      if (query) setQuery("");
      else onClose();
      return;
    }
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const viewport = getViewport();
      if (!viewport) return;
      const hits = viewport.querySelectorAll<HTMLElement>("[data-log-hit]");
      if (hits.length === 0) return;
      const next = (hitIndexRef.current + 1) % hits.length;
      hitIndexRef.current = next;
      setHitIndex(next);
      hits[next].scrollIntoView({ block: "center" });
    }
  };

  if (!isVisible) return null;

  const levelLabel: Record<LogEntry["type"], string> = {
    info: t.logLevelInfo,
    success: t.logLevelSuccess,
    warning: t.logLevelWarning,
    error: t.logLevelError,
  };

  const hitCount = query.trim() ? filtered.length : null;

  const dayLabel = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    const md = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    if (sameDate(d, now)) return `${t.logDayToday} · ${md}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDate(d, yesterday)) return `${t.logDayYesterday} · ${md}`;
    return md;
  };

  let previousDay: string | null = null;

  return (
    <div
      style={
        isMaximized
          ? {
              left: 0,
              right: 0,
              top: APP_HEADER_HEIGHT,
              height: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
            }
          : { left: 0, right: rightInset, bottom: 0, height }
      }
      // Maximized stays below the menu bar so 「查看」/「运行」 are still there to
      // use while reading logs; the header sits at `z-chrome` for that reason.
      className={`fixed z-floating flex flex-col overflow-hidden bg-card shadow-lg ${
        isMaximized ? "w-full" : "rounded-t-lg border-x border-t border-border"
      }`}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="log-panel"
    >
      {/* Top edge: the resize grip (hidden while maximized). */}
      {!isMaximized && (
        <div
          onPointerDown={handleResizeStart}
          className="h-[5px] shrink-0 cursor-row-resize bg-transparent transition-colors hover:bg-primary/15"
          aria-label={t.logResizeHint}
          title={t.logResizeHint}
        />
      )}

      {/* Title bar: identity, filters, search, actions. */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="flex select-none items-center gap-2">
          <span className="text-[13px] font-medium text-foreground">
            {t.logs}
          </span>
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {hitCount !== null
              ? t.logHits
                  .replace("{n}", String(hitCount))
                  .replace("{total}", String(logs.length))
              : `${logs.length}${t.logCountUnit ? ` ${t.logCountUnit}` : ""}`}
          </span>
        </div>

        {logs.length > 0 && (
          <>
            <div
              className="flex items-center gap-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                data-level="all"
                onClick={() => setActiveFilter("all")}
                className={`flex h-[22px] items-center gap-1 rounded-full px-2 text-[10.5px] transition-colors ${
                  activeFilter === "all"
                    ? "border border-border-soft bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {t.allLogs}
                <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
                  {logs.length}
                </span>
              </button>
              {(["info", "success", "warning", "error"] as const).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    data-level={type}
                    onClick={() => setActiveFilter(type)}
                    className={`flex h-[22px] items-center gap-1 rounded-full px-2 text-[10.5px] transition-colors ${
                      activeFilter === type
                        ? "border border-border-soft bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${LOG_DOT_CLASS[type]}`}
                    />
                    {levelLabel[type]}
                    <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
                      {totals[type]}
                    </span>
                  </button>
                ),
              )}
            </div>

            <div
              className="ml-1 flex h-[22px] items-center overflow-hidden rounded-full border border-border"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                data-scope="current"
                onClick={() => setTabScope("current")}
                className={`h-full px-2 text-[10.5px] transition-colors ${
                  tabScope === "current"
                    ? "bg-muted font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border-soft)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.logFilterCurrent}
              </button>
              <button
                type="button"
                data-scope="all"
                onClick={() => setTabScope("all")}
                className={`h-full px-2 text-[10.5px] transition-colors ${
                  tabScope === "all"
                    ? "bg-muted font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border-soft)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.logFilterAll}
              </button>
            </div>
          </>
        )}

        <div
          className="ml-auto flex h-[26px] w-[190px] items-center gap-1.5 rounded-md border border-border bg-background px-2 focus-within:border-primary"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t.logSearchPlaceholder}
            aria-label={t.logSearchPlaceholder}
            className="w-full border-0 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          {query.trim() && hitTotal > 0 && (
            <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-muted-foreground/70">
              {Math.min(hitIndex + 1, hitTotal)}/{hitTotal}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {onExport && (
            <Tooltip content={t.logExport}>
              <Button
                variant="ghost"
                size="xs"
                aria-label={t.logExport}
                onClick={() => onExport(exportText)}
                disabled={filtered.length === 0}
                className="h-7 w-7 p-0"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {onOpenLogsDir && (
            <Tooltip content={t.logOpenDir}>
              <Button
                variant="ghost"
                size="xs"
                aria-label={t.logOpenDir}
                onClick={onOpenLogsDir}
                className="h-7 w-7 p-0"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {onShowHistory && (
            <Tooltip content={t.historyButton}>
              <Button
                variant="ghost"
                size="xs"
                aria-label={t.historyButton}
                onClick={onShowHistory}
                className="h-7 w-7 p-0"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t.aiClear}>
            <Button
              variant="ghost"
              size="xs"
              aria-label={t.aiClear}
              onClick={onClear}
              disabled={logs.length === 0}
              className="h-7 w-7 p-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={isMaximized ? t.restore : t.maximize}>
            <Button
              variant="ghost"
              size="xs"
              aria-label={isMaximized ? t.restore : t.maximize}
              onClick={() => setIsMaximized(!isMaximized)}
              className="h-7 w-7 p-0"
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </Tooltip>
          <Tooltip content={t.close}>
            <Button
              variant="ghost"
              size="xs"
              aria-label={t.close}
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="px-4 pt-6">
            <p className="text-[12.5px] font-medium text-muted-foreground">
              {logs.length === 0 ? t.noLogsYet : t.noMatchingLogs}
            </p>
            {logs.length === 0 && (
              <p className="mt-0.5 text-[11.5px] text-muted-foreground/70">
                {t.executePipelineHint}
              </p>
            )}
          </div>
        ) : (
          <div className="relative pb-2 pl-7">
            {/* Timeline rail — the drawer's signature (071-02): one run = one
                stop; the node carries the run's worst severity. */}
            <div
              className="absolute bottom-4 top-2 w-px bg-border-soft"
              style={{ left: 15 }}
            />
            {groups.map((group) => {
              const isCollapsed = collapsed.has(group.key);
              const day = dayLabel(group.startedAt);
              const showDaySep = day !== previousDay;
              previousDay = day;
              return (
                <React.Fragment key={group.key}>
                  {showDaySep && (
                    <div className="flex items-center gap-2.5 py-2.5 pr-3 font-mono text-[9.5px] tabular-nums text-muted-foreground/80">
                      <span>{day}</span>
                      {group.hasDisk && <span>· {t.logFromDisk}</span>}
                      <span className="h-px flex-1 bg-border-soft" />
                    </div>
                  )}
                  <div
                    className="relative border-b border-border-soft last:border-b-0"
                    data-log-group={group.key}
                  >
                    <span
                      className={`absolute left-[-17px] top-[11px] h-[9px] w-[9px] rounded-full border-[1.5px] bg-card ${
                        RAIL_NODE_CLASS[group.status]
                      }`}
                    />
                    <button
                      type="button"
                      className="group/head flex h-8 w-full items-center gap-2 pr-3 text-left transition-colors hover:bg-muted/40"
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.key)) next.delete(group.key);
                          else next.add(group.key);
                          return next;
                        })
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRight
                          className="h-3 w-3 shrink-0 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <ChevronDown
                          className="h-3 w-3 shrink-0 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                      )}
                      <span className="min-w-0 max-w-[220px] truncate text-[11.5px] font-medium text-foreground">
                        {group.key === APP_GROUP_KEY
                          ? t.logGroupApp
                          : group.label}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {formatLineTime(new Date(group.startedAt))} ·{" "}
                        {group.entries.length}
                        {t.logCountUnit ? ` ${t.logCountUnit}` : ""}
                      </span>
                      {/* Level summary as quiet mono text — colour only on
                          the words, never a pill (unslop 071-02). */}
                      <span className="shrink-0 font-mono text-[10px] tabular-nums">
                        {group.counts.error > 0 && (
                          <span className="text-danger">
                            {group.counts.error} {levelLabel.error}
                          </span>
                        )}
                        {group.counts.warning > 0 && (
                          <>
                            {group.counts.error > 0 && " · "}
                            <span className="text-warning">
                              {group.counts.warning} {levelLabel.warning}
                            </span>
                          </>
                        )}
                        {group.status === "success" && (
                          <span className="text-muted-foreground/70">
                            {levelLabel.success}
                          </span>
                        )}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-3 pr-1 text-[10.5px] text-muted-foreground/70 opacity-0 transition-opacity duration-150 pointer-events-none group-hover/head:pointer-events-auto group-hover/head:opacity-100">
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={t.logCopyAll}
                          className="hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyGroup(group);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              copyGroup(group);
                            }
                          }}
                        >
                          {copiedGroupKey === group.key
                            ? t.copied
                            : t.logCopyAll}
                        </span>
                        {onRerun &&
                          group.tabId &&
                          (() => {
                            const rerunTabId = group.tabId;
                            return (
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label={t.logRerun}
                                className="flex items-center gap-1 hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRerun(rerunTabId);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    onRerun(rerunTabId);
                                  }
                                }}
                              >
                                {t.logRerun}
                              </span>
                            );
                          })()}
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div>
                        {group.entries.map((log) => {
                          const segments = highlightMessage(log.message, query);
                          const hasHit =
                            query.trim().length > 0 &&
                            segments.some((s) => s.hit);
                          return (
                            <div
                              key={log.id}
                              className="group/row flex items-start gap-2 py-1 pr-3 hover:bg-muted/30"
                            >
                              <span
                                className="w-[56px] shrink-0 pt-px font-mono text-[10px] tabular-nums text-muted-foreground/70"
                                title={log.timestamp.toLocaleString()}
                              >
                                {formatLineTime(log.timestamp)}
                              </span>
                              <span
                                className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${LOG_DOT_CLASS[log.type]}`}
                              />
                              <p
                                className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-[17px] text-foreground"
                                {...(hasHit ? { "data-log-hit": true } : {})}
                              >
                                {segments.map((seg, i) =>
                                  seg.hit ? (
                                    // Theme accent, not the browser-default
                                    // yellow `mark` (071 feedback).
                                    <mark
                                      key={i}
                                      className="rounded-[2px] bg-primary/15 px-0.5 font-medium text-primary"
                                    >
                                      {seg.text}
                                    </mark>
                                  ) : (
                                    <React.Fragment key={i}>
                                      {seg.text}
                                    </React.Fragment>
                                  ),
                                )}
                              </p>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <Tooltip
                                  content={
                                    copiedLogId === log.id ? t.copied : t.copy
                                  }
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t.copy}
                                    onClick={() =>
                                      void copyText(log.message, log.id)
                                    }
                                    className="h-4 w-4 opacity-0 pointer-events-none group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
                                  >
                                    {copiedLogId === log.id ? (
                                      <Check className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                      <Copy className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </Button>
                                </Tooltip>
                                {!log.fromDisk && (
                                  <Tooltip content={t.remove}>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={t.remove}
                                      onClick={() => onRemoveLog(log.id)}
                                      className="h-4 w-4 text-muted-foreground opacity-0 pointer-events-none group-hover/row:pointer-events-auto group-hover/row:opacity-100 hover:text-destructive focus-visible:pointer-events-auto focus-visible:opacity-100"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </Tooltip>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {!atLatest && filtered.length > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 right-3 z-10 flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[11px] text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          {t.logJumpToLatest}
        </button>
      )}
    </div>
  );
});
