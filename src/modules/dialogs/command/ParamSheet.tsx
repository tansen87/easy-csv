import { useEffect, useRef, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { cn } from "@/lib/utils";
import { xanCommands } from "@/data/commands";
import type { CommandFormProps } from "@/types/dialog";
import type { XanParameter } from "@/types/xan";
import {
  handleCommandSubmit,
  updateParam,
} from "@/modules/dialogs/command/lib/helpers";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import {
  PARAM_GROUP_ORDER,
  isParamVisible,
  paramField,
  paramGroup,
  paramHasValue,
  paramLabel,
} from "@/modules/dialogs/command/lib/paramMeta";
import {
  buildCommandTokens,
  commandLineText,
} from "@/modules/dialogs/command/lib/commandTokens";
import { ParamControl } from "@/modules/dialogs/command/fields/ParamControl";
import { FlagSwitch } from "@/modules/dialogs/command/fields/FlagSwitch";
import { useLanguage } from "@/i18n";

/**
 * The parameter sheet (design 080 · option C).
 *
 * The dialog body is the command itself: every parameter with a value is a token
 * on `xan <cmd>`, clicking a token opens its editor, and everything not yet on
 * the command waits in the "can add" list. Adding a step is therefore the same
 * gesture as finishing the command, and the copy button hands over the exact
 * line the run will build.
 *
 * Only the commands listed in `PARAM_SHEET_COMMANDS` use this; the rest keep
 * their hand-written forms until they are migrated.
 */
export function ParamSheet({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  headers = [],
  sourceTable,
}: CommandFormProps) {
  const { t, effectiveLanguage } = useLanguage();
  // Open a field straight away: the first required one still empty, otherwise
  // the command's own first parameter. A sheet that opens with no editor makes
  // the whole point of the command (map's expression, say) look absent.
  const [editing, setEditing] = useState<string | null>(() => {
    const target = xanCommands.find(
      (entry) => entry.id === commandDialog.type,
    );
    if (!target) return null;
    const missing = target.parameters.find(
      (param) =>
        param.required &&
        param.type !== "flag" &&
        !paramHasValue(param, commandDialog.params[param.name]),
    );
    if (missing) return missing.name;
    const first = target.parameters.find((param) => param.type !== "flag");
    return first?.name ?? null;
  });
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const command = xanCommands.find((entry) => entry.id === commandDialog.type);
  if (!command) return null;

  const params = commandDialog.params;
  // Submit merges defaults into `params`, so the sheet shows the same merged
  // view: a parameter with a default is already on the command, and a required
  // one with a default counts as satisfied.
  const withDefaults: Record<string, unknown> = {};
  for (const param of command.parameters) {
    const value = param.default;
    if (value === undefined || value === "" || value === false) continue;
    withDefaults[param.name] = value;
  }
  const effective = { ...withDefaults, ...params };
  // Fields whose `visibleWhen` does not match are not part of this command at
  // all: they leave the token line, the required count and the submit payload.
  const visible = command.parameters.filter((param) =>
    isParamVisible(param, effective),
  );
  const visibleCommand = { ...command, parameters: visible };
  const tokens = buildCommandTokens(visibleCommand, effective, effectiveLanguage);
  const onCommand = new Set(tokens.map((token) => token.name));
  const inactive = visible.filter((param) => !onCommand.has(param.name));
  const ordered = [...inactive].sort(
    (a, b) =>
      PARAM_GROUP_ORDER.indexOf(paramGroup(a)) -
      PARAM_GROUP_ORDER.indexOf(paramGroup(b)),
  );
  const required = visible.filter((param) => param.required);
  const missing = required.filter(
    (param) => !paramHasValue(param, effective[param.name]),
  );
  const requiredDone = required.length - missing.length;
  const canCopy = missing.length === 0;
  const activeParam = editing
    ? command.parameters.find((param) => param.name === editing)
    : undefined;
  const activeLabel = activeParam
    ? paramLabel(command, activeParam, effectiveLanguage)
    : "";
  const activeField = activeParam
    ? paramField(command.id, activeParam.name)
    : undefined;

  /** Only the visible fields go to the command, so a hidden one cannot leak. */
  const visibleNames = new Set(visible.map((param) => param.name));
  const submitParams = Object.fromEntries(
    Object.entries(effective).filter(([name]) => visibleNames.has(name)),
  );

  const setValue = (name: string, value: unknown) =>
    updateParam(commandDialog, setCommandDialog, name, value);

  /** Put a parameter on the command and open it. Flags need no editing. */
  const activate = (param: XanParameter) => {
    if (param.type === "flag") {
      setValue(param.name, true);
    } else if (param.default !== undefined && param.default !== "") {
      setValue(param.name, String(param.default));
    }
    setEditing(param.name);
  };

  const remove = (param: XanParameter) => {
    setValue(param.name, param.type === "flag" ? false : "");
    setEditing((current) => (current === param.name ? null : current));
  };

  const handleCopy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard?.writeText(
        commandLineText(visibleCommand, effective),
      );
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // A refused clipboard keeps the old label; nothing is lost.
    }
  };

  const description = (param: XanParameter) =>
    getParameterDescription(command.id, param.name, effectiveLanguage);

  const flagOf = (param: XanParameter) =>
    param.type !== "flag" && !param.isPositional ? `--${param.name}` : param.name;

  return (
    <div className="flex min-h-0 flex-col">
      <ScrollArea
        className="min-h-0"
        hideHorizontalScrollbar
        blockContent
        viewportStyle={{ maxHeight: "calc(80vh - 104px)" }}
      >
        <div className="px-5 pt-4 pb-3">
          {/* The command. Tokens are the source of truth. */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-[9px] border border-border bg-paper p-2.5">
            <span className="mr-0.5 font-mono text-[11.5px] text-muted-foreground">
              {/* Native commands (chart, duckdb, batch-*) run inside the app,
                  so there is no `xan` in front of them. */}
              {command.native ? command.name : `xan ${command.name}`}
            </span>
            {tokens.map((token) => {
              const param = command.parameters.find(
                (entry) => entry.name === token.name,
              );
              const on = editing === token.name;
              return (
                <span
                  key={token.name}
                  className={cn(
                    "inline-flex h-6 items-center rounded-md border font-mono text-[11.5px]",
                    on
                      ? "border-brand-border bg-brand-soft text-brand"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setEditing(token.name)}
                    className="inline-flex h-full items-center gap-1.5 pl-1.5"
                  >
                    {/* Positional parameters have no flag of their own, so the
                        parameter name stands in for it — `columns 地区`, never
                        a bare `地区` next to a file path. */}
                    <span
                      className={cn(
                        on ? "text-brand/70" : "text-muted-foreground",
                      )}
                    >
                      {token.flag || token.name}
                    </span>
                    {!token.isFlag && (
                      // A multi-line value (batch-search) would break the row;
                      // collapse whitespace for display only — the copied
                      // command keeps the original text.
                      <span className="max-w-[180px] truncate">
                        {token.value.replace(/\s+/g, " ")}
                      </span>
                    )}
                  </button>
                  {param && (
                    <button
                      type="button"
                      aria-label={`${t.paramRemove} ${token.label}`}
                      onClick={() => remove(param)}
                      className={cn(
                        "h-full px-1 text-[11px]",
                        on
                          ? "text-brand/60 hover:text-brand"
                          : "text-muted-foreground/50 hover:text-foreground",
                      )}
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => ordered[0] && activate(ordered[0])}
              disabled={ordered.length === 0}
              className="h-6 rounded-md border border-dashed border-border px-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              + {t.paramAdd}
            </button>
          </div>

          {activeParam && (
            <>
              <div className="flex items-center gap-2 pt-4 pb-2">
                <span className="font-mono text-[10.5px] text-muted-foreground/70">
                  {t.paramEditing}
                </span>
                <span className="h-px flex-1 bg-border-soft" />
              </div>
              <div className="rounded-[10px] border border-border bg-paper px-3.5 pt-3 pb-3.5">
                <div className="flex items-center gap-2">
                  {/* Parameter first, plain-language name after it — the same
                      order as the "can add" list below. */}
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="flex-none whitespace-nowrap font-mono text-[11px] text-foreground">
                      {flagOf(activeParam)}
                    </span>
                    {activeLabel !== activeParam.name && (
                      <span
                        title={activeLabel}
                        className="min-w-0 truncate text-[12px] text-muted-foreground"
                      >
                        {activeLabel}
                      </span>
                    )}
                  </span>
                  <div className="flex flex-none items-center gap-2.5">
                    {activeParam.type === "flag" && (
                      <FlagSwitch
                        on={paramHasValue(
                          activeParam,
                          effective[activeParam.name],
                        )}
                        onChange={(next) => setValue(activeParam.name, next)}
                        label={activeLabel}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => remove(activeParam)}
                      className="whitespace-nowrap text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {t.paramRemove}
                    </button>
                  </div>
                </div>
                {/* When the name already *is* the description (an uncurated
                    parameter), repeating it under the header reads as a bug. */}
                {description(activeParam).trim() !== activeLabel.trim() && (
                  <p className="mt-1 text-[11px] leading-[1.55] text-muted-foreground">
                    {description(activeParam)}
                  </p>
                )}
                {activeParam.type !== "flag" && (
                  <div className="mt-2.5">
                    <ParamControl
                      param={activeParam}
                      value={effective[activeParam.name]}
                      onChange={(value) => setValue(activeParam.name, value)}
                      commandId={command.id}
                      language={effectiveLanguage}
                      headers={headers}
                      label={activeLabel}
                      headersLabel={t.paramHeaders}
                      columnPlaceholder={t.paramPlaceholder}
                      description={description(activeParam)}
                      sourceTable={sourceTable}
                      fieldKind={activeField?.kind}
                      fieldJoin={activeField?.join}
                      folderLabel={
                        activeField?.folders ? t.paramAddFolder : undefined
                      }
                      pickFileLabel={t.paramPickFile}
                      pickFolderLabel={t.paramPickFolder}
                      addFileLabel={t.paramAddFile}
                      fileCountLabel={t.paramFileCount}
                      lineCountLabel={t.paramLineCount}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 pt-4 pb-1.5">
            <span className="font-mono text-[10.5px] text-muted-foreground/70">
              {t.paramMore}
            </span>
            <span className="h-px flex-1 bg-border-soft" />
            {missing.length > 0 && (
              <span className="text-[10.5px] text-warning">
                {/* The missing list names the parameters themselves, not their
                    translations: it is what the command line is short of. */}
                {t.paramMissing.replace(
                  "{names}",
                  missing
                    .map((param) => param.name)
                    .join(effectiveLanguage === "zh" ? "、" : ", "),
                )}
              </span>
            )}
          </div>

          {ordered.length === 0 ? (
            <p className="py-3 text-[11px] text-muted-foreground/70">
              {t.paramAllAdded}
            </p>
          ) : (
            <div className="border-t border-border-soft">
              {ordered.map((param) => {
                const label = paramLabel(
                  command,
                  param,
                  effectiveLanguage,
                );
                return (
                  <button
                    key={param.name}
                    type="button"
                    onClick={() => activate(param)}
                    aria-label={`${t.paramAdd} ${label}`}
                    className="flex h-[38px] w-full items-center gap-2.5 border-b border-border-soft text-left transition-colors hover:bg-muted/40"
                  >
                    <Plus className="h-3.5 w-3.5 flex-none text-muted-foreground/60" />
                    {/* The flag comes first so the whole list reads as a
                        column of command words, with the plain-language label
                        beside it. */}
                    <span
                      title={param.name}
                      className="w-[104px] flex-none truncate font-mono text-[10.5px] text-foreground"
                    >
                      {param.name}
                    </span>
                    {label !== param.name && (
                      <span
                        title={label}
                        className="truncate text-[12px] text-muted-foreground"
                      >
                        {label}
                      </span>
                    )}
                    {paramGroup(param) === "required" && (
                      <span className="flex-none rounded-[3px] border border-brand-border bg-brand-soft px-1 py-px text-[10px] text-brand">
                        {t.paramGroupRequired}
                      </span>
                    )}
                    <span className="ml-auto flex-none text-[11px] text-muted-foreground/60">
                      {param.type !== "flag" &&
                      param.default !== undefined &&
                      param.default !== ""
                        ? `${t.paramDefault} ${param.default}`
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-t border-border px-5">
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
          <span>
            {required.length === 0
              ? t.paramNoRequired
              : t.paramRequiredProgress
                  .replace("{done}", String(requiredDone))
                  .replace("{total}", String(required.length))}
          </span>
          {/* Nothing to copy for a native command: it runs inside the app. */}
          {!command.native && (
            <>
              <span className="h-3 w-px bg-border" />
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!canCopy}
                title={canCopy ? t.paramCopy : t.paramCopyDisabled}
                className={cn(
                  "inline-flex h-[26px] min-w-[82px] items-center justify-center gap-1.5 rounded-md border border-transparent px-2 text-[11px] transition-colors",
                  copied
                    ? "border-brand-border bg-brand-soft text-brand"
                    : "text-muted-foreground hover:text-foreground",
                  !canCopy &&
                    "cursor-default opacity-50 hover:text-muted-foreground",
                )}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? t.paramCopied : t.paramCopy}
              </button>
            </>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCommandDialog(null)}
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              handleCommandSubmit({
                commandDialog: { ...commandDialog, params: submitParams },
                onAddCommand,
                onStepUpdate,
                setCommandDialog,
              })
            }
          >
            {commandDialog.isUpdate ? t.update : t.paramAddStep}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Commands that keep a hand-written form because the sheet cannot express them:
 * file pickers (batch-*, cat, scrape), table pickers (duckdb) and the two panel
 * editors (chart, plot), plus `run`. Everything else is driven by the sheet.
 */
const BESPOKE_FORMS: ReadonlySet<string> = new Set(["run"]);

export function usesParamSheet(type: string): boolean {
  return !BESPOKE_FORMS.has(type);
}
