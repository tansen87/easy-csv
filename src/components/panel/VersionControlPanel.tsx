import { useState } from "react";
import {
  Tag,
  Clock,
  GitBranch,
  Trash2,
  RotateCcw,
  Plus,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PipelineVersion } from "@/types/xan";
import { useLanguage } from "@/i18n";

interface VersionControlPanelProps {
  versions: PipelineVersion[];
  currentVersionId?: string;
  onSaveVersion: (
    message?: string,
    tags?: string[],
  ) => Promise<PipelineVersion | undefined>;
  onRestoreVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onAddTag: (versionId: string, tag: string) => void;
  onRemoveTag: (versionId: string, tag: string) => void;
  isSaving: boolean;
  onClose: () => void;
}

export function VersionControlPanel({
  versions,
  currentVersionId,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  onAddTag,
  onRemoveTag,
  isSaving,
  onClose,
}: VersionControlPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [newTag, setNewTag] = useState("");
  const [editingTagVersionId, setEditingTagVersionId] = useState<string | null>(
    null,
  );
  const { t } = useLanguage();

  const handleSave = async () => {
    if (!newMessage.trim()) return;
    await onSaveVersion(
      newMessage.trim(),
      newTag
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    );
    setNewMessage("");
    setNewTag("");
    setIsCreating(false);
  };

  const handleAddTag = async (versionId: string) => {
    if (!newTag.trim()) return;
    await onAddTag(versionId, newTag.trim());
    setNewTag("");
    setEditingTagVersionId(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t.versionHistory}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCreating(true)}
              className="h-6 px-2 text-xs bg-primary/10 hover:bg-primary/20 rounded flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={onClose}
              className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {isCreating && (
        <div className="p-3 border-b border-border/50 bg-muted/30">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Version message..."
            className="w-full h-8 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 mb-2"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Tags (comma separated)..."
            className="w-full h-8 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 mb-2"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!newMessage.trim() || isSaving}
              className="h-6 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Version"}
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewMessage("");
                setNewTag("");
              }}
              className="h-6 px-3 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 h-[120px]">
        <div className="p-3 space-y-2">
          {versions.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-8">
              No versions saved yet
            </div>
          ) : (
            [...versions].reverse().map((version) => (
              <Card
                key={version.id}
                className={`p-3 cursor-pointer transition-all hover:bg-accent/30 ${
                  currentVersionId === version.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/50"
                }`}
                onClick={() => onRestoreVersion(version.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {version.message || "Untitled version"}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(version.createdAt).toLocaleString()}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTagVersionId(
                          editingTagVersionId === version.id
                            ? null
                            : version.id,
                        );
                      }}
                      className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                    >
                      <Tag className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreVersion(version.id);
                      }}
                      className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteVersion(version.id);
                      }}
                      className="h-5 w-5 flex items-center justify-center hover:bg-destructive/10 text-destructive rounded transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {editingTagVersionId === version.id && (
                  <div className="mt-2 flex gap-1">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add tag..."
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
                      Add
                    </button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
