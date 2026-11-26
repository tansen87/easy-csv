import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import type { XanParameter } from "@/types/xan";
import { isColumnParam } from "@/modules/dialogs/command/lib/paramMeta";
import { ColumnField } from "@/modules/dialogs/command/fields/ColumnField";
import { ExpressionEditor } from "@/components/expression/ExpressionEditor";

interface ParamControlProps {
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
  /** Seat the full xan expression editor instead of a one-line input. */
  expression?: boolean;
}

/**
 * The one control a parameter gets in the editor card (design 080).
 *
 * Kept as a module-level component so switching between parameters never
 * remounts the whole sheet. Flags are not here: their switch lives in the card
 * header, next to 移除.
 */
export function ParamControl({
  param,
  value,
  onChange,
  headers = [],
  label,
  headersLabel,
  columnPlaceholder,
  description,
  expression,
}: ParamControlProps) {
  if (expression) {
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
          label: option,
          value: option,
        }))}
        size="sm"
        ariaLabel={label}
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
