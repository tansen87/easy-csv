import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { X, Pencil, Trash2, Download, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useLanguage } from "@/i18n";
import { PipelineTemplate } from "@/types/xan";

interface PipelineTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templates: PipelineTemplate[];
  canSave: boolean;
  currentStepCount: number;
  defaultName: string;
  onSave: (name: string, description?: string) => void;
  onApply: (id: string) => void;
  onRename: (id: string, name: string, description?: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onImport: () => void;
}

/** `MM-DD` for templates from this year, `YYYY-MM-DD` for older ones. */
function formatTemplateDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (date.getFullYear() !== new Date().getFullYear()) {
    return `${date.getFullYear()}-${month}-${day}`;
  }
  return `${month}-${day}`;
}

export function PipelineTemplateDialog({
  isOpen,
  onClose,
  templates,
  canSave,
  currentStepCount,
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

  /** One template as a record row: index, name, pipeline chain, then actions. */
  const renderTemplateRow = (tpl: PipelineTemplate, index: number) => {
    const isRenaming = renamingId === tpl.id;
    const steps = tpl.snapshot.pipeline;
    const chain = steps
      .map((step) => step.commandId)
      .filter(Boolean)
      .join(" → ");

    if (isRenaming) {
      return (
        <li
          key={tpl.id}
          className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0"
        >
          <span className="w-6 shrink-0 pt-2 font-mono text-[10.5px] text-muted-foreground tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <input
              data-saveonenter="true"
              data-kind="rename"
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder={t.templateName}
              className="h-7 w-full rounded-md border border-transparent bg-muted px-2.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <input
              type="text"
              value={renameDesc}
              onChange={(e) => setRenameDesc(e.target.value)}
              placeholder={t.templateDescriptionPlaceholder}
              className="h-7 w-full rounded-md border border-transparent bg-muted px-2.5 text-[11.5px] text-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1 pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11.5px] text-primary"
              onClick={commitRename}
            >
              {t.save}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11.5px]"
              onClick={() => setRenamingId(null)}
            >
              {t.cancel}
            </Button>
          </div>
        </li>
      );
    }

    return (
      <li
        key={tpl.id}
        className="group flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-muted/30"
      >
        <span className="w-6 shrink-0 font-mono text-[10.5px] text-muted-foreground tabular-nums group-hover:text-primary">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="max-w-[70%] shrink-0 truncate text-[13px] font-medium text-foreground">
              {tpl.name}
            </span>
            {tpl.description && (
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                {tpl.description}
              </span>
            )}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground tabular-nums">
            {chain && (
              <>
                <span className="min-w-0 truncate text-foreground/70">
                  {chain}
                </span>
                <span className="shrink-0 text-muted-foreground/50">·</span>
              </>
            )}
            <span className="shrink-0">
              {t.templateStepCountShort.replace("{n}", String(steps.length))}
            </span>
            <span className="shrink-0 text-muted-foreground/50">·</span>
            <span className="shrink-0">{formatTemplateDate(tpl.updated)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="order-2 h-7 border border-transparent px-2 text-[11.5px] text-muted-foreground group-hover:border-border group-hover:text-primary"
            onClick={() => onApply(tpl.id)}
          >
            {t.templateApply}
          </Button>
          <Tooltip content={t.templateRename}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.templateRename}
              className="h-7 w-7 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
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
              size="icon-sm"
              aria-label={t.templateExport}
              className="h-7 w-7 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
              onClick={() => onExport(tpl.id)}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t.templateDelete}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.templateDelete}
              className="h-7 w-7 text-muted-foreground opacity-0 pointer-events-none hover:text-destructive group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
              onClick={() => onDelete(tpl.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </li>
    );
  };

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
        className="relative flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-card shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Title bar: title + count on the left, search centered, close on the right */}
        <div className="relative flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-5">
          <span className="text-[15px] font-medium text-foreground">
            {t.paletteTemplates}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {templates.length} {t.templateCountUnit}
          </span>
          {templates.length > 0 && (
            <div className="absolute left-1/2 top-1/2 w-[280px] -translate-x-1/2 -translate-y-1/2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.templateSearchPlaceholder}
                aria-label={t.templateSearchPlaceholder}
                className="h-8 w-full rounded-md border border-transparent bg-muted pl-[30px] pr-2 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.close}
            className="ml-auto"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Save the current pipeline as a template */}
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="text-xs font-medium text-foreground">
              {t.templateSaveAsTitle}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {t.templateStepCount.replace("{n}", String(currentStepCount))}
            </span>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11.5px] text-muted-foreground"
              onClick={onImport}
            >
              <Upload className="h-3.5 w-3.5" />
              {t.templateImport}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={saveNameRef}
              data-saveonenter="true"
              data-kind="new"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={!canSave}
              placeholder={t.templateName}
              className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-muted px-2.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              disabled={!canSave}
              placeholder={t.templateDescriptionPlaceholder}
              className="h-8 min-w-0 flex-[1.35] rounded-md border border-transparent bg-muted px-2.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
            <Button
              className="h-8 shrink-0 px-3.5 text-xs"
              disabled={!canSave || !newName.trim()}
              onClick={handleSave}
            >
              {t.save}
            </Button>
          </div>
          {!canSave && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t.templateNameRequired}
            </p>
          )}
        </div>

        {/* Saved templates: one record row each */}
        <ScrollArea
          className="min-h-0 flex-1"
          hideHorizontalScrollbar
          blockContent
          viewportClassName="max-h-[46vh] overflow-y-auto"
        >
          {templates.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] font-medium text-foreground">
                {t.templateEmptyTitle}
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                {t.noTemplates}
              </p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <p className="px-5 py-10 text-center text-[11.5px] text-muted-foreground">
              {t.templateNoMatches}
            </p>
          ) : (
            <ul>
              {filteredTemplates.map((tpl, index) =>
                renderTemplateRow(tpl, index),
              )}
            </ul>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
