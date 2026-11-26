import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import type { XanParameter } from "@/types/xan";
import {
  isColumnParam,
  optionLabel,
  type ParamFieldKind,
} from "@/modules/dialogs/command/lib/paramMeta";
import type { EffectiveLanguage } from "@/i18n/translations/types";
import { ColumnField } from "@/modules/dialogs/command/fields/ColumnField";
import { PathField } from "@/modules/dialogs/command/fields/PathField";
import { PathListField } from "@/modules/dialogs/command/fields/PathListField";
import { LinesField } from "@/modules/dialogs/command/fields/LinesField";
import { ExpressionEditor } from "@/components/expression/ExpressionEditor";
import { DuckdbEditor } from "@/components/expression/DuckdbEditor";

interface ParamControlProps {
  /** Owning command, so option labels can be resolved per command. */
  commandId: string;
  language: EffectiveLanguage;
  param: XanParameter;
  value: unknown;
  onChange: (value: unknown) => void;
  headers?: string[];
  /** Localized field name, used as the control's accessible name. */
  label: string;
  /** Localized "headers" label for the column chip row. */
  headersLabel: string;
  /** Only the column field uses it: type a name, or pick a header. */
  columnPlaceholder: string;
  /** The parameter's description, used as the expression editor's hint. */
  description?: string;
  /** Richer control than `param.type` implies: path, path list or code. */
  fieldKind?: ParamFieldKind;
  /** Separator to write a list back with, instead of an array. */
  fieldJoin?: string;
  /** Folder picker label; omitted means files only. */
  folderLabel?: string;
  /** Selected table of a `.duckdb` input, for the SQL editor's templates. */
  sourceTable?: string;
  pickFileLabel?: string;
  pickFolderLabel?: string;
  addFileLabel?: string;
  fileCountLabel?: string;
  lineCountLabel?: string;
}

/**
 * The one control a parameter gets in the editor card (design 080).
 *
 * Kept as a module-level component so switching between parameters never
 * remounts the whole sheet. Flags are not here: their switch lives in the card
 * header, next to 移除.
 */
export function ParamControl({
  commandId,
  language,
  param,
  value,
  onChange,
  headers = [],
  label,
  headersLabel,
  columnPlaceholder,
  description,
  fieldKind,
  fieldJoin,
  folderLabel,
  sourceTable,
  pickFileLabel = "",
  pickFolderLabel = "",
  addFileLabel = "",
  fileCountLabel = "",
  lineCountLabel = "",
}: ParamControlProps) {
  if (fieldKind === "lines") {
    return (
      <LinesField
        value={value}
        onChange={(next) => onChange(next)}
        label={label}
        placeholder={description}
        countLabel={lineCountLabel}
      />
    );
  }

  if (fieldKind === "path") {
    return (
      <PathField
        value={String(value ?? "")}
        onChange={(next) => onChange(next)}
        label={label}
        placeholder={description}
        pickFileLabel={pickFileLabel}
        pickFolderLabel={pickFolderLabel}
      />
    );
  }

  if (fieldKind === "path-list") {
    return (
      <PathListField
        value={value}
        onChange={(next) => onChange(next)}
        label={label}
        addLabel={addFileLabel}
        countLabel={fileCountLabel}
        join={fieldJoin}
        folderLabel={folderLabel}
      />
    );
  }

  if (fieldKind === "sql") {
    return (
      <DuckdbEditor
        value={String(value ?? "")}
        onChange={(next) => onChange(next)}
        columns={headers}
        placeholder={description}
        sourceTable={sourceTable}
        autoFocus
      />
    );
  }

  if (fieldKind === "code") {
    return (
      <ExpressionEditor
        value={String(value ?? "")}
        onChange={(next) => onChange(next)}
        columns={headers}
        placeholder={description}
        autoFocus
      />
    );
  }

  if (param.type === "select" && param.options?.length) {
    return (
      <Select
        value={String(value ?? "")}
        onChange={(next) => onChange(next)}
        options={param.options.map((option) => ({
          label: optionLabel(commandId, param.name, option, language),
          value: option,
        }))}
        size="sm"
        ariaLabel={label}
        // Same treatment as the batch forms: the sheet's scroll box would clip
        // a long option list, and `to --format` alone has nine entries.
        portal
        flip
        listMaxHeight="max-h-[420px]"
      />
    );
  }

  if (isColumnParam(param)) {
    return (
      <ColumnField
        value={String(value ?? "")}
        onChange={(next) => onChange(next)}
        headers={headers}
        placeholder={columnPlaceholder}
        ariaLabel={label}
        headersLabel={headersLabel}
        autoFocus
      />
    );
  }

  return (
    <input
      type={param.type === "number" ? "number" : "text"}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      autoFocus
      className={cn(
        "h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px]",
        "text-foreground outline-none placeholder:text-muted-foreground/60",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
      )}
    />
  );
}
