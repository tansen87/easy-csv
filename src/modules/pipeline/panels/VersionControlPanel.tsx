import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, RotateCcw, Search, Tag, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/modules/dialogs/common/ConfirmDialog";
import {
  EditorKind,
  RowActions,
  VersionLogRow,
} from "@/modules/pipeline/panels/VersionLogRow";
import { PipelineVersion } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { relativeStamp } from "@/utils/format";
import {
  PipelineSnapshot,
  VersionDiff,
  diffSnapshots,
  snapshotsEqual,
  summarizeDiff,
} from "@/utils/versionDiff";

interface VersionControlPanelProps {
  versions: PipelineVersion[];
  currentVersionId?: string;
  currentSnapshot?: PipelineSnapshot;
  onSaveVersion: (
    message?: string,
    tags?: string[],
  ) => Promise<PipelineVersion | undefined>;
  onRestoreVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onClearAllVersions?: () => void;
  onAddTag: (versionId: string, tag: string) => void;
  onRemoveTag: (versionId: string, tag: string) => void;
  onRenameVersion: (versionId: string, message: string) => void;
  isSaving: boolean;
  onClose: () => void;
}

type ViewMode = "list" | "timeline";

interface EditorState {
  kind: EditorKind;
  versionId: string;
  value: string;
}

interface MenuState {
  versionId: string;
  x: number;
  y: number;
}

interface LogRow {
  version: PipelineVersion;
  depth: number;
}

const EMPTY_SNAPSHOT: PipelineSnapshot = { steps: [], edges: [] };
const MENU_WIDTH = 152;
const MENU_HEIGHT = 128;

function snapshotOf(version?: PipelineVersion): PipelineSnapshot {
  return { steps: version?.steps || [], edges: version?.edges || [] };
}

/**
 * Newest first in both modes. The list is flat; the timeline nests children
 * under their parent (`parentId`) and indents them. Search results are always
 * flat — a filtered tree with missing ancestors reads as broken nesting.
 */
function buildRows(
  versions: PipelineVersion[],
  mode: ViewMode,
  searching: boolean,
): LogRow[] {
  const newestFirst = <T,>(items: T[]): T[] => [...items].reverse();
  if (mode === "list" || searching) {
    return newestFirst(versions).map((version) => ({ version, depth: 0 }));
  }

  const ids = new Set(versions.map((v) => v.id));
  const children = new Map<string, PipelineVersion[]>();
  versions.forEach((version) => {
    if (!version.parentId || !ids.has(version.parentId)) return;
    const bucket = children.get(version.parentId);
    if (bucket) bucket.push(version);
    else children.set(version.parentId, [version]);
  });

  const rows: LogRow[] = [];
  const walk = (version: PipelineVersion, depth: number) => {
    if (depth > 32) return;
    rows.push({ version, depth });
    newestFirst(children.get(version.id) ?? []).forEach((child) =>
      walk(child, depth + 1),
    );
  };
  const roots = versions.filter((v) => !v.parentId || !ids.has(v.parentId));
  newestFirst(roots).forEach((root) => walk(root, 0));
  return rows;
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex h-[26px] w-full items-center gap-2 rounded-md px-2 text-left text-[11.5px] transition-colors",
        danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Version history docked on the right of the canvas (design 044).
 *
 * A commit log rather than a stack of cards: one 56px row per version joined by
 * a continuous rail, with the diff expanding inside the row so the list is
 * never pushed off-screen by a fixed-height compare block.
 */
export function VersionControlPanel({
  versions,
  currentVersionId,
  currentSnapshot,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  onClearAllVersions,
  onAddTag,
  onRemoveTag,
  onRenameVersion,
  isSaving,
  onClose,
}: VersionControlPanelProps) {
  const { t } = useLanguage();

  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState("current");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const workspace = currentSnapshot || EMPTY_SNAPSHOT;
  const currentVersion = versions.find((v) => v.id === currentVersionId);
  const dirty =
    !!currentVersion && !snapshotsEqual(snapshotOf(currentVersion), workspace);
  const searching = query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter(
      (v) =>
        (v.message || "").toLowerCase().includes(q) ||
        (v.tags || []).some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [versions, query]);

  const rows = useMemo(
    () => buildRows(filtered, viewMode, searching),
    [filtered, viewMode, searching],
  );

  /** Diff of the expanded row against the selected baseline, oldest → newest. */
  const expandedDiff = useMemo<VersionDiff | null>(() => {
    const selected = versions.find((v) => v.id === expandedId);
    if (!selected) return null;
    const selectedSnapshot = snapshotOf(selected);
    const targetVersion = versions.find((v) => v.id === compareTargetId);
    const targetSnapshot = targetVersion
      ? snapshotOf(targetVersion)
      : workspace;
    const selectedIndex = versions.indexOf(selected);
    const targetIndex = targetVersion ? versions.indexOf(targetVersion) : -1;
    const targetIsOlder = targetVersion && targetIndex < selectedIndex;
    return diffSnapshots(
      targetIsOlder ? targetSnapshot : selectedSnapshot,
      targetIsOlder ? selectedSnapshot : targetSnapshot,
    );
  }, [versions, expandedId, compareTargetId, workspace]);

  /** `+2 −1 ~1` per version, measured against its parent. */
  const summaryOf = useCallback(
    (version: PipelineVersion) => {
      const parent =
        versions.find((v) => v.id === version.parentId) ||
        versions[versions.indexOf(version) - 1];
      if (!parent) return null;
      return summarizeDiff(
        diffSnapshots(snapshotOf(parent), snapshotOf(version)),
      );
    },
    [versions],
  );

  const timeLabel = useCallback(
    (version: PipelineVersion) => {
      const stamp = relativeStamp(version.createdAt);
      if (!stamp) return version.createdAt;
      switch (stamp.kind) {
        case "today":
          return t.versionTimeToday.replace("{time}", stamp.clock);
        case "yesterday":
          return t.versionTimeYesterday.replace("{time}", stamp.clock);
        case "date":
          return t.versionTimeMonthDay
            .replace("{month}", String(stamp.month))
            .replace("{day}", String(stamp.day));
        default:
          return t.versionTimeFull
            .replace("{year}", String(stamp.year))
            .replace("{month}", String(stamp.month))
            .replace("{day}", String(stamp.day));
      }
    },
    [t],
  );

  const saveSummary = useMemo(() => {
    if (!currentVersion) return null;
    return summarizeDiff(diffSnapshots(snapshotOf(currentVersion), workspace));
  }, [currentVersion, workspace]);

  const resetComposer = useCallback(() => {
    setComposerOpen(false);
    setDraftMessage("");
    setDraftTags([]);
    setTagDraft("");
  }, []);

  const openComposer = useCallback(() => {
    setEditor(null);
    setMenu(null);
    setExpandedId(null);
    setComposerOpen(true);
  }, []);

  const submitComposer = useCallback(async () => {
    if (isSaving) return;
    try {
      await onSaveVersion(draftMessage.trim() || undefined, draftTags);
      resetComposer();
    } catch {
      // The hook already logged the failure; keep the composer open so the
      // message and tags are not lost on a transient backend error.
    }
  }, [draftMessage, draftTags, isSaving, onSaveVersion, resetComposer]);

  const addDraftTag = useCallback(() => {
    const tag = tagDraft.trim().replace(/^#/, "");
    if (!tag) return;
    setDraftTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagDraft("");
  }, [tagDraft]);

  const commitEditor = useCallback(async () => {
    if (!editor) return;
    const value = editor.value.trim();
    try {
      if (editor.kind === "message" && value) {
        await onRenameVersion(editor.versionId, value);
      }
      if (editor.kind === "tag" && value) {
        await onAddTag(editor.versionId, value.replace(/^#/, ""));
      }
    } catch {
      // The hook logged it; closing the editor keeps the UI usable.
    } finally {
      setEditor(null);
    }
  }, [editor, onAddTag, onRenameVersion]);

  const toggleExpanded = useCallback(
    (version: PipelineVersion) => {
      setEditor(null);
      setMenu(null);
      setExpandedId((prev) => {
        if (prev === version.id) return null;
        const parent = versions.find((v) => v.id === version.parentId);
        setCompareTargetId(parent ? parent.id : "current");
        return version.id;
      });
    },
    [versions],
  );

  const openMenu = useCallback(
    (version: PipelineVersion, event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      // Keep the popover inside the window: flip above the button when there is
      // no room below, and never let it cross the left edge.
      const x = Math.max(
        8,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      );
      const y =
        rect.bottom + MENU_HEIGHT + 8 > window.innerHeight
          ? rect.top - MENU_HEIGHT - 6
          : rect.bottom + 6;
      setMenu({ versionId: version.id, x, y });
    },
    [],
  );

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  const actions: RowActions = useMemo(
    () => ({
      toggle: toggleExpanded,
      openMenu,
      removeTag: (version, tag) => onRemoveTag(version.id, tag),
      restore: (versionId) => setRestoringId(versionId),
      remove: (versionId) => setDeletingId(versionId),
      setCompareTarget: setCompareTargetId,
      setEditorValue: (value) =>
        setEditor((prev) => (prev ? { ...prev, value } : prev)),
      commitEditor: () => void commitEditor(),
      cancelEditor: () => setEditor(null),
    }),
    [toggleExpanded, openMenu, onRemoveTag, commitEditor],
  );

  const composerFacts = t.versionSaveFacts
    .replace("{steps}", String(workspace.steps.length))
    .replace("{edges}", String(workspace.edges.length));
  const composerAgainst =
    saveSummary &&
    (saveSummary.addedSteps > 0 ||
      saveSummary.removedSteps > 0 ||
      saveSummary.modifiedSteps > 0)
      ? t.versionSaveAgainst
          .replace("{name}", currentVersion?.message || t.untitledVersion)
          .replace("{added}", String(saveSummary.addedSteps))
          .replace("{removed}", String(saveSummary.removedSteps))
      : null;

  return (
    <div
      className="flex h-full flex-col bg-card"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex-none px-4 pt-3">
        <div className="flex h-7 items-center gap-2">
          <h3 className="text-[13px] font-medium">{t.versionHistory}</h3>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={openComposer}
              className="flex h-[26px] items-center gap-1 rounded-[7px] bg-primary/10 pl-[7px] pr-2.5 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/15"
            >
              {t.saveVersion}
            </button>
            <button
              type="button"
              aria-label={t.close}
              onClick={onClose}
              className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {versions.length > 0 && (
          <div className="mt-0.5 flex h-5 items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
            <span>
              {t.versionPanelMeta.replace("{count}", String(versions.length))}
            </span>
            {dirty && (
              <>
                <span className="opacity-60">·</span>
                <span className="truncate text-foreground">
                  {t.versionDirtyHint}
                </span>
              </>
            )}
          </div>
        )}

        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.versionSearchPlaceholder}
            className="h-8 w-full rounded-lg border border-border bg-card pl-7 pr-7 text-[12px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-primary focus:shadow-[0_0_0_2px_var(--brand-soft)]"
          />
          {query && (
            <button
              type="button"
              aria-label={t.versionClearSearch}
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {composerOpen ? (
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-4 pt-3">
          <h4 className="text-xs font-medium text-muted-foreground">
            {t.versionSaveTitle}
          </h4>
          <input
            type="text"
            autoFocus
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void submitComposer();
              }
              if (e.key === "Escape") resetComposer();
            }}
            placeholder={t.versionMessagePlaceholder}
            className="h-8 w-full rounded-[7px] border border-border bg-card px-2.5 text-[12px] outline-none focus:border-primary"
          />
          <div className="flex min-h-[30px] flex-wrap items-center gap-1 rounded-[7px] border border-border bg-card px-1.5 py-1">
            {draftTags.map((tag) => (
              <span
                key={tag}
                className="flex h-5 items-center gap-1 rounded bg-muted px-1.5 text-[10.5px]"
              >
                <span className="text-muted-foreground/70">#</span>
                {tag}
                <button
                  type="button"
                  aria-label={t.versionRemoveTag.replace("{tag}", tag)}
                  onClick={() =>
                    setDraftTags((prev) => prev.filter((x) => x !== tag))
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraftTag();
                }
                if (e.key === "Backspace" && !tagDraft && draftTags.length) {
                  setDraftTags((prev) => prev.slice(0, -1));
                }
                if (e.key === "Escape") resetComposer();
              }}
              placeholder={t.versionTagInputPlaceholder}
              className="h-5 min-w-[60px] flex-1 bg-transparent px-1 text-[11px] outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <p className="text-[10.5px] leading-relaxed text-muted-foreground tabular-nums">
            {composerFacts}
            {composerAgainst && <> · {composerAgainst}</>}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submitComposer()}
              disabled={isSaving}
              className="h-7 rounded-[7px] bg-primary px-3 text-[11.5px] font-medium text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {isSaving ? t.saving : t.saveVersion}
            </button>
            <button
              type="button"
              onClick={resetComposer}
              className="h-7 rounded-[7px] px-2 text-[11.5px] text-muted-foreground hover:text-foreground"
            >
              {t.cancel}
            </button>
            <span className="ml-auto flex items-center gap-1 font-mono text-[9.5px] text-muted-foreground/70">
              <kbd className="rounded border border-border px-1 leading-[13px]">
                Ctrl
              </kbd>
              <kbd className="rounded border border-border px-1 leading-[13px]">
                ↵
              </kbd>
            </span>
          </div>
        </div>
      ) : versions.length === 0 ? (
        <div className="flex-1 overflow-y-auto px-4 pt-6">
          <h4 className="text-[12.5px] font-medium">{t.versionEmptyTitle}</h4>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {t.versionEmptyDesc.replace(
              "{steps}",
              String(workspace.steps.length),
            )}
          </p>
          <button
            type="button"
            onClick={openComposer}
            className="mt-3 flex h-7 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2.5 text-[11.5px] transition-colors hover:bg-muted"
          >
            {t.versionEmptyAction}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 overflow-y-auto px-4 pt-6">
          <h4 className="text-[12.5px] font-medium">
            {t.versionNoMatchTitle.replace("{query}", query.trim())}
          </h4>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {t.versionNoMatchHint}
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 h-7 rounded-[7px] border border-border bg-card px-2.5 text-[11.5px] transition-colors hover:bg-muted"
          >
            {t.versionClearSearch}
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pt-2">
          {rows.map((row, index) => (
            <VersionLogRow
              key={row.version.id}
              version={row.version}
              depth={row.depth}
              first={index === 0}
              last={index === rows.length - 1}
              isCurrent={currentVersionId === row.version.id}
              isExpanded={expandedId === row.version.id}
              menuOpen={menu?.versionId === row.version.id}
              summary={summaryOf(row.version)}
              timeLabel={timeLabel(row.version)}
              diff={expandedId === row.version.id ? expandedDiff : null}
              versions={versions}
              compareTargetId={compareTargetId}
              editor={
                editor?.versionId === row.version.id
                  ? { kind: editor.kind, value: editor.value }
                  : null
              }
              actions={actions}
            />
          ))}
        </div>
      )}

      {/* Footer: view mode + the destructive action, kept away from the rows */}
      {!composerOpen && versions.length > 0 && (
        <div className="flex h-9 flex-none items-center gap-2 border-t border-border/60 px-4">
          <div
            role="group"
            aria-label={`${t.listView} / ${t.timelineView}`}
            className="flex gap-0.5 rounded-[7px] bg-muted p-0.5"
          >
            {(["list", "timeline"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "h-5 rounded-[5px] px-2 text-[10.5px] transition-colors",
                  viewMode === mode
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "list" ? t.listView : t.timelineView}
              </button>
            ))}
          </div>
          {onClearAllVersions && (
            <button
              type="button"
              onClick={() => setClearingAll(true)}
              className="ml-auto text-[10.5px] text-muted-foreground transition-colors hover:text-destructive"
            >
              {t.clearAllVersions}
            </button>
          )}
        </div>
      )}

      {/* Row menu — a portal so the scroll container cannot clip it */}
      {menu &&
        createPortal(
          <div
            className="fixed inset-0 z-modal"
            onMouseDown={() => setMenu(null)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              role="menu"
              style={{ left: menu.x, top: menu.y, width: MENU_WIDTH }}
              className="absolute rounded-lg border border-border bg-card p-1 shadow-lg"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MenuItem
                icon={<Pencil className="h-3 w-3 text-muted-foreground" />}
                label={t.versionEditMessage}
                onClick={() => {
                  const version = versions.find((v) => v.id === menu.versionId);
                  setMenu(null);
                  if (version) {
                    setEditor({
                      kind: "message",
                      versionId: version.id,
                      value: version.message || "",
                    });
                  }
                }}
              />
              <MenuItem
                icon={<Tag className="h-3 w-3 text-muted-foreground" />}
                label={t.versionEditTag}
                onClick={() => {
                  const versionId = menu.versionId;
                  setMenu(null);
                  setEditor({ kind: "tag", versionId, value: "" });
                }}
              />
              <MenuItem
                icon={<RotateCcw className="h-3 w-3 text-muted-foreground" />}
                label={t.restore}
                onClick={() => {
                  const versionId = menu.versionId;
                  setMenu(null);
                  setRestoringId(versionId);
                }}
              />
              <div className="my-1 h-px bg-border/60" />
              <MenuItem
                icon={<Trash2 className="h-3 w-3" />}
                label={t.versionMenuDelete}
                danger
                onClick={() => {
                  const versionId = menu.versionId;
                  setMenu(null);
                  setDeletingId(versionId);
                }}
              />
            </div>
          </div>,
          document.body,
        )}

      <ConfirmDialog
        isOpen={!!deletingId}
        title={t.versionMenuDelete}
        message={t.confirmDeleteVersion}
        detail={
          versions.find((v) => v.id === deletingId)?.message ||
          t.untitledVersion
        }
        tone="danger"
        confirmLabel={t.deleteSteps}
        onConfirm={() => {
          if (deletingId) onDeleteVersion(deletingId);
          setDeletingId(null);
        }}
        onCancel={() => setDeletingId(null)}
      />
      <ConfirmDialog
        isOpen={!!restoringId}
        title={t.confirmRestoreTitle}
        message={t.confirmRestoreDesc}
        confirmLabel={t.restore}
        onConfirm={() => {
          if (restoringId) onRestoreVersion(restoringId);
          setRestoringId(null);
        }}
        onCancel={() => setRestoringId(null)}
      />
      <ConfirmDialog
        isOpen={clearingAll}
        title={t.clearAllVersions}
        message={t.confirmClearAllVersions}
        tone="danger"
        confirmLabel={t.clear}
        onConfirm={() => {
          onClearAllVersions?.();
          setClearingAll(false);
        }}
        onCancel={() => setClearingAll(false)}
      />
    </div>
  );
}
