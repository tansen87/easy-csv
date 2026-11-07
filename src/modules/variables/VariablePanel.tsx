import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { Select } from "@/components/ui/Select";
import {
  PipelineStep,
  PipelineVariable,
  PipelineVariableType,
} from "@/types/xan";
import {
  collectVariableRefs,
  inferVariableType,
  isValidVariableName,
  VariableRef,
} from "@/utils/params";
import { useLanguage } from "@/i18n";
import {
  TYPE_OPTIONS,
  VariableRow,
  typeLabel,
} from "@/modules/variables/VariableRow";

interface VariablePanelProps {
  steps: PipelineStep[];
  variables: PipelineVariable[];
  onChange: (variables: PipelineVariable[]) => void;
  onClose: () => void;
}

/**
 * 管道变量面板（设计 046）。
 *
 * 一行一个变量的台账，按「待填写 → 已就绪 → 仅管道引用」分组：第一组回答
 * 「什么会挡住执行」，第三组回答「哪些只是被引用、还没存下来」。点值行就地
 * 改默认值，点名称行展开它被哪几个参数引用。持久化的仍然只有声明列表
 * （`tab.variables`），「仅管道引用」的项只有点「声明」才会写进去。
 */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-5 pb-10">
      <h4 className="text-[12.5px] font-medium">{t.variableEmptyTitle}</h4>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {t.variableEmptyDesc1}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {t.variableEmptyDesc2}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex h-7 w-max items-center gap-1.5 rounded-md bg-brand px-2.5 text-[11.5px] text-brand-foreground transition-colors hover:bg-brand/90"
      >
        {t.addVariable}
      </button>
    </div>
  );
}

export function VariablePanel({
  steps,
  variables,
  onChange,
  onClose,
}: VariablePanelProps) {
  const { t } = useLanguage();

  // 引用永远实时从管道参数里扫，声明的才落库 —— 与执行侧同一套语义。
  const refs = useMemo(() => collectVariableRefs(steps), [steps]);

  const refsByName = useMemo(() => {
    const map = new Map<string, VariableRef[]>();
    for (const item of refs) {
      const list = map.get(item.name);
      if (list) list.push(item);
      else map.set(item.name, [item]);
    }
    return map;
  }, [refs]);

  const declaredNames = useMemo(
    () => new Set(variables.map((v) => v.name)),
    [variables],
  );

  // 分组只看声明列表：待填写 = 已声明但默认值为空；仅管道引用 = 还没声明。
  const pendingVars = useMemo(
    () => variables.filter((v) => !String(v.defaultValue ?? "").trim()),
    [variables],
  );
  const readyVars = useMemo(
    () => variables.filter((v) => String(v.defaultValue ?? "").trim()),
    [variables],
  );
  const referencedOnly = useMemo(
    () => [...refsByName.keys()].filter((name) => !declaredNames.has(name)),
    [refsByName, declaredNames],
  );

  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PipelineVariableType>("string");

  const panelMenuRef = useRef<HTMLDivElement>(null);

  // 行菜单点击外部关闭;Select 的下拉自己管 outside-click,这里只看行菜单壳。
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.(`[data-row-menu="${menuFor}"]`)) return;
      if (target?.closest?.(`[data-row-menu-button="${menuFor}"]`)) return;
      setMenuFor(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuFor]);

  useEffect(() => {
    if (!panelMenuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (
        panelMenuRef.current &&
        !panelMenuRef.current.contains(event.target as Node)
      ) {
        setPanelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panelMenuOpen]);

  // 重新执行 / 删步骤后变量可能已不在管道里，收起展开与编辑态避免悬挂。
  useEffect(() => {
    if (expanded && !refsByName.has(expanded) && !declaredNames.has(expanded)) {
      setExpanded(null);
    }
    if (editing && !declaredNames.has(editing)) setEditing(null);
    if (menuFor && !declaredNames.has(menuFor)) setMenuFor(null);
  }, [refsByName, declaredNames, expanded, editing, menuFor]);

  const isEmpty = variables.length === 0 && referencedOnly.length === 0;

  const upsert = (name: string, patch: Partial<PipelineVariable>) => {
    onChange(
      variables.some((v) => v.name === name)
        ? variables.map((v) => (v.name === name ? { ...v, ...patch } : v))
        : [
            ...variables,
            { name, defaultValue: "", type: "string", ...patch } as PipelineVariable,
          ],
    );
  };

  const setDefault = (name: string, value: string) => {
    // 只写默认值，不碰类型：手选的类型不再被推断覆盖（设计 046 §5）。
    upsert(name, { defaultValue: value });
  };

  const setType = (name: string, type: PipelineVariableType) => {
    upsert(name, { type });
  };

  const declare = (name: string) => {
    if (declaredNames.has(name)) return;
    onChange([
      ...variables,
      { name, defaultValue: "", type: inferVariableType("") },
    ]);
    setExpanded(name);
  };

  const removeVariable = (name: string) => {
    onChange(variables.filter((v) => v.name !== name));
  };

  const clearAll = () => {
    onChange([]);
    setConfirmingClear(false);
    setExpanded(null);
    setEditing(null);
    setMenuFor(null);
  };

  const nameTaken =
    variables.some((v) => v.name === newName.trim()) ||
    referencedOnly.includes(newName.trim());
  const nameValid = isValidVariableName(newName.trim());
  const canAdd = newName.trim().length > 0 && nameValid && !nameTaken;

  const addVariable = () => {
    const name = newName.trim();
    if (!canAdd) return;
    onChange([...variables, { name, defaultValue: "", type: newType }]);
    setNewName("");
    setNewType("string");
    setAddOpen(false);
  };

  const renderGroup = (
    label: string,
    count: number,
    tone: "warning" | "muted",
    items: PipelineVariable[],
    note?: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <>
        <div
          className={cn(
            "flex h-[30px] items-baseline gap-1.5 px-4 text-[10.5px]",
            tone === "warning" ? "text-warning" : "text-muted-foreground",
          )}
        >
          <span>{label}</span>
          <span
            className={cn(
              "ml-auto font-mono text-[10px] tabular-nums",
              tone === "warning" ? "text-warning/80" : "text-muted-foreground/60",
            )}
          >
            {count}
          </span>
        </div>
        {note && (
          <p className="px-4 pb-1 text-[10.5px] leading-[18px] text-muted-foreground">
            {note}
          </p>
        )}
        {items.map((v) => (
          <VariableRow
            key={v.name}
            name={v.name}
            value={String(v.defaultValue ?? "")}
            type={v.type}
            declared
            refs={refsByName.get(v.name) ?? []}
            open={expanded === v.name}
            editing={editing === v.name}
            menuOpen={menuFor === v.name}
            onToggle={() =>
              setExpanded((current) => (current === v.name ? null : v.name))
            }
            onStartEdit={() => setEditing(v.name)}
            onCommitEdit={(value) => {
              setDefault(v.name, value);
              setEditing(null);
            }}
            onCancelEdit={() => setEditing(null)}
            onMenuToggle={() =>
              setMenuFor((current) => (current === v.name ? null : v.name))
            }
            onMenuClose={() => setMenuFor(null)}
            onCopy={() => {
              void navigator.clipboard?.writeText(`{{${v.name}}}`).catch(() => {});
            }}
            onSetType={(ty) => setType(v.name, ty)}
            onDelete={() => removeVariable(v.name)}
            onDeclare={() => declare(v.name)}
          />
        ))}
      </>
    );
  };

  return (
    <div
      className="flex h-full flex-col bg-card"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex-none px-4 pt-3">
        <div className="flex h-7 items-center gap-2">
          <h3 className="text-[13px] font-medium">{t.variables}</h3>
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip content={t.variableMenu}>
              <button
                type="button"
                aria-label={t.variableMenu}
                aria-expanded={panelMenuOpen}
                disabled={variables.length === 0}
                onClick={() => setPanelMenuOpen((open) => !open)}
                className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <MoreHorizontal className="h-[13px] w-[13px]" />
              </button>
            </Tooltip>
            <Tooltip content={t.close}>
              <button
                type="button"
                aria-label={t.close}
                onClick={onClose}
                className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {panelMenuOpen && variables.length > 0 && (
        <div
          ref={panelMenuRef}
          className="absolute right-3 top-10 z-50 w-[150px] rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          <button
            type="button"
            onClick={() => {
              setPanelMenuOpen(false);
              setConfirmingClear(true);
            }}
            className="flex h-[26px] w-full items-center gap-2 rounded-md px-2 text-left text-[11.5px] text-danger transition-colors hover:bg-danger-soft"
          >
            <span className="flex-1">{t.variableClearAll}</span>
          </button>
        </div>
      )}

      {confirmingClear && variables.length > 0 && (
        <div className="mx-4 mt-2 flex-none rounded-lg border border-border bg-background p-2.5">
          <h5 className="text-[11.5px] font-medium">
            {t.variableConfirmClear.replace(
              "{count}",
              String(variables.length),
            )}
          </h5>
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            {t.variableConfirmClearDesc}
          </p>
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="h-[26px] rounded-md border border-border px-2.5 text-[11px] text-foreground transition-colors hover:bg-muted"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="h-[26px] rounded-md bg-danger px-2.5 text-[11px] text-white transition-colors hover:bg-danger/90"
            >
              {t.variableConfirmAction}
            </button>
          </div>
        </div>
      )}

      {isEmpty && !addOpen ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pt-1">
          {renderGroup(
            t.variableGroupPending,
            pendingVars.length,
            "warning",
            pendingVars,
            pendingVars.length > 0 ? t.variablePendingHint : undefined,
          )}
          {renderGroup(t.variableGroupReady, readyVars.length, "muted", readyVars)}
          {referencedOnly.length > 0 && (
            <>
              <div className="flex h-[30px] items-baseline gap-1.5 px-4 text-[10.5px] text-muted-foreground">
                <span>{t.variableGroupReferenced}</span>
                <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  {referencedOnly.length}
                </span>
              </div>
              {referencedOnly.map((name) => (
                <VariableRow
                  key={name}
                  name={name}
                  value=""
                  type="string"
                  declared={false}
                  refs={refsByName.get(name) ?? []}
                  open={expanded === name}
                  editing={false}
                  menuOpen={false}
                  onToggle={() =>
                    setExpanded((current) => (current === name ? null : name))
                  }
                  onStartEdit={() => undefined}
                  onCommitEdit={() => undefined}
                  onCancelEdit={() => undefined}
                  onMenuToggle={() => undefined}
                  onMenuClose={() => undefined}
                  onCopy={() => undefined}
                  onSetType={() => undefined}
                  onDelete={() => undefined}
                  onDeclare={() => declare(name)}
                />
              ))}
            </>
          )}

          {addOpen ? (
            <div className="mx-4 mt-1.5 rounded-lg border border-border bg-background p-2">
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addVariable()}
                  placeholder={t.variableName}
                  aria-label={t.variableName}
                  className={cn(
                    "h-7 min-w-0 flex-1 rounded-md border bg-card px-2 text-[11.5px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary",
                    newName.trim().length > 0 &&
                      !nameValid &&
                      "border-danger shadow-[0_0_0_2px_var(--danger-soft)]",
                  )}
                />
                <Select
                  value={newType}
                  onChange={(v) => setNewType(v as PipelineVariableType)}
                  options={TYPE_OPTIONS.map((ty) => ({
                    label: typeLabel(t, ty),
                    value: ty,
                  }))}
                  ariaLabel={t.variableType}
                  width="88px"
                  height="h-7"
                  listMaxHeight="max-h-32"
                />
                <button
                  type="button"
                  onClick={addVariable}
                  disabled={!canAdd}
                  className="h-7 flex-none rounded-md bg-brand px-2.5 text-[11.5px] text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
                >
                  {t.commandAdd}
                </button>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-[10px] leading-[15px]",
                  newName.trim().length > 0 && !nameValid
                    ? "text-danger"
                    : nameTaken
                      ? "text-danger"
                      : "text-muted-foreground/70",
                )}
              >
                {newName.trim().length > 0 && !nameValid
                  ? t.variableNameRule
                  : nameTaken
                    ? t.variableDuplicateName
                    : `${t.variableNameRule};${t.variableNameUsage}`}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mx-4 mt-1.5 flex h-8 w-[calc(100%-32px)] items-center gap-1.5 rounded-lg border border-dashed border-border px-2 text-[11.5px] text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground"
            >
              {t.addVariable}
            </button>
          )}
        </div>
      )}

      {!isEmpty && (
        <div className="flex h-9 flex-none items-center gap-1.5 border-t border-border/60 px-4 text-[10.5px] tabular-nums text-muted-foreground">
          <span>
            {t.variableTotal.replace("{count}", String(variables.length))}
          </span>
          {pendingVars.length > 0 && (
            <>
              <span className="opacity-60">·</span>
              <span className="text-warning">
                {t.variablePendingTotal.replace(
                  "{count}",
                  String(pendingVars.length),
                )}
              </span>
            </>
          )}
          {referencedOnly.length > 0 && (
            <span className="ml-auto font-mono text-[9.5px] text-muted-foreground/60">
              {t.variableReferencedTotal.replace(
                "{count}",
                String(referencedOnly.length),
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
