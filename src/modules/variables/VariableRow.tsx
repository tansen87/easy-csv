import { useEffect, useRef, useState } from "react";
import { ChevronRight, Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { Select } from "@/components/ui/Select";
import { PipelineVariableType } from "@/types/xan";
import { VariableRef } from "@/utils/params";
import { useLanguage } from "@/i18n";

export const TYPE_OPTIONS: PipelineVariableType[] = [
  "string",
  "number",
  "path",
];

export function typeLabel(
  t: ReturnType<typeof useLanguage>["t"],
  type: PipelineVariableType,
): string {
  if (type === "number") return t.variableTypeNumber;
  if (type === "path") return t.variableTypePath;
  return t.variableTypeString;
}

/** 展开后的引用清单里的一行。 */
function RefRow({ item }: { item: VariableRef }) {
  return (
    <div className="grid h-6 grid-cols-[20px_minmax(0,1fr)] items-center gap-2 text-[11px]">
      <span className="font-mono text-[9.5px] text-muted-foreground/60">
        {String(item.stepIndex).padStart(2, "0")}
      </span>
      <span
        className="truncate"
        title={`${item.commandLabel} · ${item.paramKey}`}
      >
        {item.commandLabel}
        <span className="ml-1.5 font-mono text-[9.5px] text-muted-foreground/60">
          {item.paramKey}
        </span>
      </span>
    </div>
  );
}

export interface VariableRowProps {
  name: string;
  value: string;
  type: PipelineVariableType;
  declared: boolean;
  refs: VariableRef[];
  open: boolean;
  editing: boolean;
  menuOpen: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onCommitEdit: (value: string) => void;
  onCancelEdit: () => void;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onCopy: () => void;
  onSetType: (type: PipelineVariableType) => void;
  onDelete: () => void;
  onDeclare: () => void;
}

export function VariableRow({
  name,
  value,
  type,
  declared,
  refs,
  open,
  editing,
  menuOpen,
  onToggle,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onMenuToggle,
  onMenuClose,
  onCopy,
  onSetType,
  onDelete,
  onDeclare,
}: VariableRowProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  const hasValue = value.trim().length > 0;
  const pending = declared && !hasValue;
  const unused = refs.length === 0;
  const firstRef = refs[0];

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    onCommitEdit(draft);
  };

  return (
    <>
      <div
        data-variable-row={name}
        className={cn(
          "group relative grid min-h-[48px] content-center gap-px py-1.5 pl-[18px] pr-4 transition-colors hover:bg-muted/70",
          (open || editing) && "bg-muted",
          pending &&
            "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-r-sm before:bg-warning",
          !declared && "text-muted-foreground",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`{{${name}}}`}
            className={cn(
              "min-w-0 flex-1 truncate text-left font-mono text-[11.5px] leading-[17px]",
              declared ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="text-muted-foreground/60">{"{{"}</span>
            {name}
            <span className="text-muted-foreground/60">{"}}"}</span>
          </button>
          {unused ? (
            <span className="flex-none text-[9.5px] text-muted-foreground/60">
              {t.variableUnused}
            </span>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              aria-label={t.variableRefsCount.replace(
                "{count}",
                String(refs.length),
              )}
              className="flex flex-none items-center gap-1 font-mono text-[9.5px] tabular-nums text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              {t.variableRefsCount.replace("{count}", String(refs.length))}
              <ChevronRight
                className={cn(
                  "h-2.5 w-2.5 transition-transform",
                  open && "rotate-90 text-brand",
                )}
              />
            </button>
          )}
          {declared && (
            <Tooltip content={t.variableMenu}>
              <button
                type="button"
                data-row-menu-button={name}
                aria-label={`{{${name}}} ${t.variableMenu}`}
                aria-expanded={menuOpen}
                onClick={onMenuToggle}
                className={cn(
                  "grid h-[22px] w-[22px] flex-none place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground",
                  menuOpen
                    ? "bg-muted text-foreground opacity-100"
                    : "opacity-0 focus:opacity-100 group-hover:opacity-100",
                )}
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </Tooltip>
          )}
        </div>

        {editing ? (
          <div className="mt-0.5 flex items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  cancelledRef.current = false;
                  onCommitEdit(draft);
                } else if (e.key === "Escape") {
                  cancelledRef.current = true;
                  onCancelEdit();
                }
              }}
              aria-label={`{{${name}}} ${t.variableDefault}`}
              className="h-[26px] min-w-0 flex-1 rounded-md border border-primary bg-card px-2 text-[11.5px] text-foreground shadow-[0_0_0_2px_var(--brand-soft)] outline-none"
            />
            <span className="flex flex-none items-center gap-0.5">
              <kbd className="rounded border border-border px-0.5 font-mono text-[9px] leading-[14px] text-muted-foreground/70">
                ↵
              </kbd>
              <kbd className="rounded border border-border px-0.5 font-mono text-[9px] leading-[14px] text-muted-foreground/70">
                esc
              </kbd>
            </span>
          </div>
        ) : declared ? (
          <button
            type="button"
            onClick={onStartEdit}
            aria-label={`{{${name}}} ${t.variableDefault}: ${hasValue ? value : t.variableNotSet}`}
            className="flex min-w-0 cursor-text items-baseline gap-1.5 text-left"
          >
            <span className="w-[22px] flex-none text-[10px] text-muted-foreground/70">
              {t.variableDefault}
            </span>
            {hasValue ? (
              <span className="min-w-0 truncate font-mono text-[10.5px] text-muted-foreground underline-offset-[3px] decoration-muted-foreground/60 hover:underline hover:decoration-dotted">
                {value}
              </span>
            ) : (
              <span className="text-[11.5px] text-warning">
                {t.variableNotSet}
              </span>
            )}
          </button>
        ) : (
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="w-[22px] flex-none text-[10px] text-muted-foreground/70">
              {t.variableUsedBy}
            </span>
            {firstRef && (
              <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                {t.variableUsedAt.replace("{index}", String(firstRef.stepIndex))}
                <span className="px-1 opacity-60">·</span>
                {firstRef.commandLabel}
                {refs.length > 1 && (
                  <span className="ml-1 font-mono text-[9.5px] text-muted-foreground/60">
                    +{refs.length - 1}
                  </span>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={onDeclare}
              className="ml-auto flex-none text-[10.5px] text-brand hover:underline hover:underline-offset-2"
            >
              {t.variableDeclare}
            </button>
          </div>
        )}

        {menuOpen && declared && (
          <div
            data-row-menu={name}
            className="absolute right-2 top-9 z-50 w-[150px] rounded-lg border border-border bg-popover p-1 shadow-md"
          >
            <button
              type="button"
              onClick={() => {
                onCopy();
                onMenuClose();
              }}
              className="flex h-[26px] w-full items-center gap-2 rounded-md px-2 text-left text-[11.5px] text-popover-foreground transition-colors hover:bg-muted"
            >
              <Copy className="h-3 w-3 flex-none text-muted-foreground" />
              <span className="flex-1 truncate">
                {t.variableCopyName.replace("{name}", name)}
              </span>
            </button>
            <div className="mx-1.5 my-1 h-px bg-border/60" />
            <div className="px-2 pb-1 pt-0.5">
              <div className="text-[10px] text-muted-foreground/70">
                {t.variableType}
              </div>
              <Select
                value={type}
                onChange={(v) => {
                  onSetType(v as PipelineVariableType);
                  onMenuClose();
                }}
                options={TYPE_OPTIONS.map((ty) => ({
                  label: typeLabel(t, ty),
                  value: ty,
                }))}
                ariaLabel={`{{${name}}} ${t.variableType}`}
                height="h-7"
                listMaxHeight="max-h-32"
              />
            </div>
            <div className="mx-1.5 my-1 h-px bg-border/60" />
            <button
              type="button"
              onClick={() => {
                onDelete();
                onMenuClose();
              }}
              className="flex h-[26px] w-full items-center gap-2 rounded-md px-2 text-left text-[11.5px] text-danger transition-colors hover:bg-danger-soft"
            >
              <Trash2 className="h-3 w-3 flex-none" />
              <span className="flex-1">{t.deleteVariable}</span>
            </button>
          </div>
        )}
      </div>

      {open && refs.length > 0 && (
        <div className="border-t border-border/60 bg-muted px-4 pb-2.5 pt-0.5">
          <div className="flex h-[22px] items-center text-[10px] text-muted-foreground/80">
            {t.variableRefsCaption.replace("{count}", String(refs.length))}
          </div>
          {refs.map((item) => (
            <RefRow key={`${item.stepId}-${item.paramKey}`} item={item} />
          ))}
        </div>
      )}
    </>
  );
}

