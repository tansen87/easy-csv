import { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Tag,
  Clock,
  GitBranch,
  Trash2,
  RotateCcw,
  Plus,
  X,
  Search,
  Pencil,
  GitCompare,
  Network,
  List,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Tooltip } from "@/components/ui/tooltip";
import { PipelineVersion } from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { useLanguage } from "@/i18n";
import {
  PipelineSnapshot,
  VersionDiff,
  diffSnapshots,
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

interface VersionNode {
  version: PipelineVersion;
  children: VersionNode[];
}

function snapshotOf(v: PipelineVersion | undefined): PipelineSnapshot {
  return {
    steps: v?.steps || [],
    edges: v?.edges || [],
  };
}

function commandName(commandId: string): string {
  return xanCommands.find((c) => c.id === commandId)?.name || commandId;
}

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
  const [isCreating, setIsCreating] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [creatingTag, setCreatingTag] = useState("");
  const [editingTagVersionId, setEditingTagVersionId] = useState<string | null>(
    null,
  );
  const [editingTag, setEditingTag] = useState("");
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(
    null,
  );
  const [restoringVersion, setRestoringVersion] =
    useState<PipelineVersion | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [editingMessageVersionId, setEditingMessageVersionId] = useState<
    string | null
  >(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [compareTargetId, setCompareTargetId] = useState<string>("current");
  const { t } = useLanguage();

  const handleSave = useCallback(async () => {
    if (!newMessage.trim()) return;
    await onSaveVersion(
      newMessage.trim(),
      creatingTag
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    setNewMessage("");
    setCreatingTag("");
    setIsCreating(false);
  }, [newMessage, creatingTag, onSaveVersion]);

  const handleAddTag = useCallback(
    async (versionId: string) => {
      if (!editingTag.trim()) return;
      await onAddTag(versionId, editingTag.trim());
      setEditingTag("");
      setEditingTagVersionId(null);
    },
    [editingTag, onAddTag],
  );

  const handleStartEditTag = useCallback(
    (versionId: string) => {
      if (editingTagVersionId === versionId) {
        setEditingTagVersionId(null);
        setEditingTag("");
      } else {
        setEditingTagVersionId(versionId);
        setEditingTag("");
      }
    },
    [editingTagVersionId],
  );

  const handleStartEditMessage = useCallback(
    (version: PipelineVersion) => {
      if (editingMessageVersionId === version.id) {
        setEditingMessageVersionId(null);
        setEditingMessage("");
      } else {
        setEditingMessageVersionId(version.id);
        setEditingMessage(version.message || "");
      }
    },
    [editingMessageVersionId],
  );

  const handleRename = useCallback(
    async (versionId: string) => {
      const message = editingMessage.trim();
      if (message) {
        await onRenameVersion(versionId, message);
      }
      setEditingMessageVersionId(null);
      setEditingMessage("");
    },
    [editingMessage, onRenameVersion],
  );

  const handleSelectVersion = useCallback(
    (version: PipelineVersion) => {
      if (selectedVersionId === version.id) {
        setSelectedVersionId(null);
        return;
      }
      setSelectedVersionId(version.id);
      const parent = versions.find((v) => v.id === version.parentId);
      setCompareTargetId(parent ? parent.id : "current");
    },
    [selectedVersionId, versions],
  );

  const filteredVersions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter(
      (v) =>
        (v.message || "").toLowerCase().includes(q) ||
        (v.tags || []).some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [versions, searchQuery]);

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

  const versionDiff = useMemo<VersionDiff | null>(() => {
    const selected = versions.find((v) => v.id === selectedVersionId);
    if (!selected) return null;
    const selectedSnap = snapshotOf(selected);
    const targetSnap =
      compareTargetId === "current"
        ? currentSnapshot || { steps: [], edges: [] }
        : snapshotOf(versions.find((v) => v.id === compareTargetId));

    const selectedIndex = versions.indexOf(selected);
    const targetVersion = versions.find((v) => v.id === compareTargetId);
    const targetIndex = targetVersion ? versions.indexOf(targetVersion) : -1;

    // Always diff oldest -> newest so added/removed read naturally.
    const base =
      targetVersion && targetIndex < selectedIndex ? targetSnap : selectedSnap;
    const target =
      targetVersion && targetIndex < selectedIndex ? selectedSnap : targetSnap;

    return diffSnapshots(base, target);
  }, [versions, selectedVersionId, compareTargetId, currentSnapshot]);

  const tree = useMemo<VersionNode[]>(() => {
    const idSet = new Set(versions.map((v) => v.id));
    const childrenMap = new Map<string, PipelineVersion[]>();
    versions.forEach((v) => {
      if (v.parentId && idSet.has(v.parentId)) {
        childrenMap.set(v.parentId, [
          ...(childrenMap.get(v.parentId) || []),
          v,
        ]);
      }
    });
    const build = (v: PipelineVersion): VersionNode => ({
      version: v,
      children: (childrenMap.get(v.id) || []).map(build),
    });
    return versions
      .filter((v) => !v.parentId || !idSet.has(v.parentId))
      .map(build);
  }, [versions]);

  const restorePreviewDiff = useMemo<VersionDiff | null>(() => {
    if (!restoringVersion) return null;
    return diffSnapshots(
      currentSnapshot || { steps: [], edges: [] },
      snapshotOf(restoringVersion),
    );
  }, [restoringVersion, currentSnapshot]);

  const renderVersionCard = (version: PipelineVersion) => {
    const summary = summaryOf(version);
    const isCurrent = currentVersionId === version.id;
    const isSelected = selectedVersionId === version.id;
    return (
      <Card
        key={version.id}
        className={`p-3 transition-all cursor-pointer ${
          isCurrent
            ? "border-primary/50 bg-primary/5"
            : isSelected
              ? "border-primary/70 bg-primary/10"
              : "border-border/50"
        }`}
        onClick={() => handleSelectVersion(version)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {editingMessageVersionId === version.id ? (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editingMessage}
                  onChange={(e) => setEditingMessage(e.target.value)}
                  placeholder={t.versionMessagePlaceholder}
                  className="flex-1 h-6 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(version.id);
                    if (e.key === "Escape") {
                      setEditingMessageVersionId(null);
                      setEditingMessage("");
                    }
                  }}
                />
                <button
                  onClick={() => handleRename(version.id)}
                  className="h-6 px-2 text-[10px] bg-primary/10 hover:bg-primary/20 rounded transition-colors"
                >
                  {t.save}
                </button>
              </div>
            ) : (
              <div className="text-xs font-medium truncate flex items-center gap-1">
                {version.message || t.untitledVersion}
                {isCurrent && (
                  <span className="shrink-0 px-1 py-0.5 text-[9px] bg-primary text-primary-foreground rounded">
                    {t.versionCurrent}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(version.createdAt).toLocaleString()}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {summary && (
                <span className="text-[10px] text-muted-foreground">
                  {summary.addedSteps > 0 && (
                    <span className="text-emerald-600">
                      +{summary.addedSteps}
                    </span>
                  )}
                  {summary.addedSteps > 0 && summary.removedSteps > 0 && "  "}
                  {summary.removedSteps > 0 && (
                    <span className="text-destructive">
                      -{summary.removedSteps}
                    </span>
                  )}
                  {(summary.addedSteps > 0 || summary.removedSteps > 0) &&
                    ` ${t.versionSteps}`}
                </span>
              )}
            </div>
            {version.tags && version.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {version.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTag(version.id, tag);
                      }}
                      className="hover:text-destructive"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Tooltip content={t.versionEditMessage}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEditMessage(version);
                }}
                className="h-5 w-5 flex items-center justify-center hover:bg-foreground/10 rounded transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </Tooltip>
            <Tooltip content={t.versionEditTag}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEditTag(version.id);
                }}
                className="h-5 w-5 flex items-center justify-center hover:bg-foreground/10 rounded transition-colors"
              >
                <Tag className="h-3 w-3" />
              </button>
            </Tooltip>
            <Tooltip content={t.restore}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRestoringVersion(version);
                }}
                className="h-5 w-5 flex items-center justify-center hover:bg-foreground/10 rounded transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </Tooltip>
            <Tooltip content={t.remove}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingVersionId(version.id);
                }}
                className="h-5 w-5 flex items-center justify-center hover:bg-foreground/10 rounded transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Tooltip>
          </div>
        </div>

        {editingTagVersionId === version.id && (
          <div className="mt-2 flex gap-1">
            <input
              type="text"
              value={editingTag}
              onChange={(e) => setEditingTag(e.target.value)}
              placeholder={t.addTag}
              className="flex-1 h-6 px-2 text-[10px] border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddTag(version.id);
                }
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddTag(version.id);
              }}
              className="h-6 px-2 text-[10px] bg-primary/10 hover:bg-primary/20 rounded transition-colors"
            >
              {t.save}
            </button>
          </div>
        )}
      </Card>
    );
  };

  const renderTree = (nodes: VersionNode[]) => (
    <div className="space-y-1.5">
      {nodes.map((node) => (
        <div key={node.version.id}>
          {renderVersionCard(node.version)}
          {node.children.length > 0 && (
            <div className="ml-3 mt-1.5 pl-2 border-l border-border/40 space-y-1.5">
              {renderTree(node.children)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="h-full flex flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t.versionHistory}
          </h3>
          <div className="flex items-center gap-1">
            {versions.length > 0 && onClearAllVersions && (
              <Tooltip content={t.clearAllVersions}>
                <Button
                  onClick={() => setClearingAll(true)}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 rounded-md hover:bg-primary/10 hover:text-primary"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
            )}
            <Tooltip
              content={viewMode === "list" ? t.timelineView : t.listView}
            >
              <Button
                onClick={() =>
                  setViewMode(viewMode === "list" ? "timeline" : "list")
                }
                size="sm"
                variant="ghost"
                className="h-6 w-6 rounded-md hover:bg-primary/10"
              >
                {viewMode === "list" ? (
                  <Network className="h-3.5 w-3.5" />
                ) : (
                  <List className="h-3.5 w-3.5" />
                )}
              </Button>
            </Tooltip>
            <Tooltip content={t.save}>
              <Button
                onClick={() => setIsCreating(true)}
                size="sm"
                variant="ghost"
                className="h-6 w-6 rounded-md hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Button
              onClick={onClose}
              size="sm"
              variant="ghost"
              className="h-6 w-6 rounded-md hover:bg-primary/10"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {versions.length > 0 && (
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.versionSearchPlaceholder}
              className="w-full h-7 pl-7 pr-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        )}
      </div>

      {isCreating && (
        <div className="p-3 border-b border-border/50 bg-muted/30">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t.versionMessagePlaceholder}
            className="w-full h-8 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 mb-2"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <input
            type="text"
            value={creatingTag}
            onChange={(e) => setCreatingTag(e.target.value)}
            placeholder={t.tagsPlaceholder}
            className="w-full h-8 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 mb-2"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!newMessage.trim() || isSaving}
              className="h-6 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? t.saving : t.saveVersion}
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewMessage("");
                setCreatingTag("");
              }}
              className="h-6 px-3 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {versionDiff && (
        <ScrollArea className="h-60 shrink-0">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium flex items-center gap-1">
                <GitCompare className="h-3 w-3" />
                {t.versionDiff}
              </span>
              <button
                onClick={() => setSelectedVersionId(null)}
                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <SearchableSelect
              value={compareTargetId}
              onChange={(v) => setCompareTargetId(v)}
              options={[
                {
                  value: "current",
                  label: t.versionCompareWithCurrent,
                },
                ...versions.map((v) => ({
                  value: v.id,
                  label: v.message || t.untitledVersion,
                })),
              ]}
              placeholder={t.versionCompareWithCurrent}
            />
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              {versionDiff.addedSteps.length > 0 && (
                <div className="text-emerald-600">
                  + {versionDiff.addedSteps.length} {t.versionAddedSteps}:{" "}
                  {versionDiff.addedSteps
                    .map((s) => commandName(s.commandId))
                    .join(", ")}
                </div>
              )}
              {versionDiff.removedSteps.length > 0 && (
                <div className="text-destructive">
                  - {versionDiff.removedSteps.length} {t.versionRemovedSteps}:{" "}
                  {versionDiff.removedSteps
                    .map((s) => commandName(s.commandId))
                    .join(", ")}
                </div>
              )}
              {versionDiff.modifiedSteps.length > 0 && (
                <div className="text-amber-600">
                  ~ {versionDiff.modifiedSteps.length} {t.versionModifiedSteps}:{" "}
                  {versionDiff.modifiedSteps
                    .map(
                      (m) =>
                        `${commandName(m.before.commandId)} → ${commandName(m.after.commandId)}`,
                    )
                    .join(", ")}
                </div>
              )}
              {versionDiff.addedEdges.length > 0 && (
                <div>
                  + {versionDiff.addedEdges.length} {t.versionEdges}:{" "}
                  {versionDiff.addedEdges
                    .map((e) => `${e.source} → ${e.target}`)
                    .join(", ")}
                </div>
              )}
              {versionDiff.removedEdges.length > 0 && (
                <div className="text-destructive">
                  - {versionDiff.removedEdges.length} {t.versionEdges}:{" "}
                  {versionDiff.removedEdges
                    .map((e) => `${e.source} → ${e.target}`)
                    .join(", ")}
                </div>
              )}
              {versionDiff.addedSteps.length === 0 &&
                versionDiff.removedSteps.length === 0 &&
                versionDiff.modifiedSteps.length === 0 &&
                versionDiff.addedEdges.length === 0 &&
                versionDiff.removedEdges.length === 0 && (
                  <div>{t.versionNoChanges}</div>
                )}
            </div>
          </div>
        </ScrollArea>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {versions.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-8">
              {t.noVersionsSaved}
            </div>
          ) : filteredVersions.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-8">
              {t.noMatchingVersions}
            </div>
          ) : viewMode === "list" ? (
            [...filteredVersions].reverse().map(renderVersionCard)
          ) : (
            renderTree(tree)
          )}
        </div>
      </ScrollArea>

      {deletingVersionId &&
        createPortal(
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="bg-background border border-border rounded-lg p-4 shadow-lg w-[280px]">
              <p className="text-sm mb-4">{t.confirmDeleteVersion}</p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setDeletingVersionId(null)}
                  size="sm"
                  variant="secondary"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={() => {
                    onDeleteVersion(deletingVersionId);
                    setDeletingVersionId(null);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  {t.confirm}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {restoringVersion &&
        createPortal(
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="bg-background border border-border rounded-lg p-4 shadow-lg w-[320px]">
              <p className="text-sm font-medium mb-1">
                {t.confirmRestoreTitle}
              </p>
              <p className="text-xs text-muted-foreground mb-2 truncate">
                {restoringVersion.message || t.untitledVersion}
              </p>
              {restorePreviewDiff && (
                <div className="text-[11px] text-muted-foreground mb-3 space-y-0.5">
                  {restorePreviewDiff.addedSteps.length > 0 && (
                    <div className="text-emerald-600">
                      + {restorePreviewDiff.addedSteps.length}{" "}
                      {t.versionAddedSteps}
                    </div>
                  )}
                  {restorePreviewDiff.removedSteps.length > 0 && (
                    <div className="text-destructive">
                      - {restorePreviewDiff.removedSteps.length}{" "}
                      {t.versionRemovedSteps}
                    </div>
                  )}
                  {restorePreviewDiff.modifiedSteps.length > 0 && (
                    <div className="text-amber-600">
                      ~ {restorePreviewDiff.modifiedSteps.length}{" "}
                      {t.versionModifiedSteps}
                    </div>
                  )}
                  {restorePreviewDiff.addedSteps.length === 0 &&
                    restorePreviewDiff.removedSteps.length === 0 &&
                    restorePreviewDiff.modifiedSteps.length === 0 && (
                      <div>{t.versionNoChanges}</div>
                    )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mb-4">
                {t.confirmRestoreDesc}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setRestoringVersion(null)}
                  size="sm"
                  variant="secondary"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={() => {
                    onRestoreVersion(restoringVersion.id);
                    setRestoringVersion(null);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  {t.restore}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {clearingAll &&
        createPortal(
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="bg-background border border-border rounded-lg p-4 shadow-lg w-[280px]">
              <p className="text-sm mb-4">{t.confirmClearAllVersions}</p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setClearingAll(false)}
                  size="sm"
                  variant="secondary"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={() => {
                    onClearAllVersions?.();
                    setClearingAll(false);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  {t.confirm}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
