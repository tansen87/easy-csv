import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import {
  X,
  Save,
  Check,
  Play,
  Pencil,
  Trash2,
  Download,
  Upload,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/i18n";
import { PipelineTemplate } from "@/types/xan";

interface PipelineTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templates: PipelineTemplate[];
  canSave: boolean;
  defaultName: string;
  onSave: (name: string, description?: string) => void;
  onApply: (id: string) => void;
  onRename: (id: string, name: string, description?: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onImport: () => void;
}

export function PipelineTemplateDialog({
  isOpen,
  onClose,
  templates,
  canSave,
  defaultName,
  onSave,
  onApply,
  onRename,
  onDelete,
  onExport,
  onImport,
}: PipelineTemplateDialogProps) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const saveNameRef = useRef<HTMLInputElement>(null);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDesc, setRenameDesc] = useState("");

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((tpl) => {
      const text = [tpl.name, tpl.description, (tpl.tags || []).join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [templates, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setNewName(defaultName);
      setNewDesc("");
      setSearchQuery("");
      setRenamingId(null);
      requestAnimationFrame(() => saveNameRef.current?.focus());
      dialogRef.current?.focus();
    }
  }, [isOpen, defaultName]);

  const handleSave = useCallback(() => {
    const name = newName.trim();
    if (!canSave || !name) return;
    onSave(name, newDesc.trim() || undefined);
  }, [canSave, newName, newDesc, onSave]);

  const commitRename = useCallback(() => {
    const name = renameName.trim();
    if (renamingId && name) {
      onRename(renamingId, name, renameDesc.trim() || undefined);
    }
    setRenamingId(null);
  }, [renamingId, renameName, renameDesc, onRename]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (renamingId) {
          setRenamingId(null);
        } else {
          onClose();
        }
        return;
      }
      if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" && target.dataset.saveonenter) {
          e.preventDefault();
          if (target.dataset.kind === "new") handleSave();
          else commitRename();
        }
      }
    },
    [onClose, renamingId, handleSave, commitRename],
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-none"
        onClick={() => {
          if (renamingId) setRenamingId(null);
          else onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-card rounded-lg shadow-xl w-full max-w-lg overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Save current pipeline as template */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2 text-sm text-foreground">
            <span>{t.paletteTemplates}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              ref={saveNameRef}
              data-saveonenter="true"
              data-kind="new"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={!canSave}
              placeholder={t.templateName}
              className="flex-1 h-8 px-2 rounded-md bg-muted text-sm text-foreground outline-none border border-transparent focus:border-primary disabled:opacity-50"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!canSave || !newName.trim()}
              onClick={handleSave}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {t.save}
            </Button>
          </div>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            disabled={!canSave}
            placeholder={t.templateDescriptionPlaceholder}
            className="w-full h-8 px-2 rounded-md bg-muted text-sm text-foreground outline-none border border-transparent focus:border-primary disabled:opacity-50"
          />
          {!canSave && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t.noTemplates}
            </p>
          )}
        </div>

        {/* Saved templates list */}
        {templates.length > 0 && (
          <div className="px-4 py-2 border-b border-border">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.templateSearchPlaceholder}
                className="w-full h-8 pl-8 pr-2 rounded-md bg-muted text-sm text-foreground outline-none border border-transparent focus:border-primary"
              />
            </div>
          </div>
        )}
        <ScrollArea className="h-64">
          <div className="px-4 py-3">
            {templates.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t.noTemplates}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t.templateNoMatches}
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredTemplates.map((tpl) => {
                  const isRenaming = renamingId === tpl.id;
                  return (
                    <li
                      key={tpl.id}
                      className="flex items-start justify-between gap-3 p-2 rounded-md border border-border bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">
                        {isRenaming ? (
                          <div className="space-y-1">
                            <input
                              data-saveonenter="true"
                              data-kind="rename"
                              type="text"
                              value={renameName}
                              onChange={(e) => setRenameName(e.target.value)}
                              placeholder={t.templateName}
                              className="w-full h-7 px-2 rounded-md bg-muted text-sm text-foreground outline-none border border-transparent focus:border-primary"
                            />
                            <input
                              type="text"
                              value={renameDesc}
                              onChange={(e) => setRenameDesc(e.target.value)}
                              placeholder={t.templateDescriptionPlaceholder}
                              className="w-full h-7 px-2 rounded-md bg-muted text-xs text-foreground outline-none border border-transparent focus:border-primary"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-foreground truncate">
                              {tpl.name}
                            </div>
                            {tpl.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {tpl.description}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isRenaming ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={commitRename}
                            >
                              <Check className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRenamingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onApply(tpl.id)}
                            >
                              <Play className="h-3.5 w-3.5 mr-1" />
                              {t.templateApply}
                            </Button>
                            <Tooltip content={t.templateRename}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setRenamingId(tpl.id);
                                  setRenameName(tpl.name);
                                  setRenameDesc(tpl.description || "");
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </Tooltip>
                            <Tooltip content={t.templateExport}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onExport(tpl.id)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </Tooltip>
                            <Tooltip content={t.templateDelete}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDelete(tpl.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
          <Button variant="secondary" size="sm" onClick={onImport}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            {t.templateImport}
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
