/**
 * Pure translation from "what the user right-clicked" to "what the command
 * dialog should be prefilled with".
 *
 * Before design 019 §3.1, 11 floating dialogs each rebuilt the same command
 * parameters by hand (`xanCommands.find(...)` + string assembly), while the
 * `command/forms/*` tree built them again from the `COMMAND_FORMS` map. Two
 * implementations of one contract meant a fix in one never reached the other.
 *
 * Now the canvas menu only reports context and this function — pure, no React,
 * no I/O — derives the parameters. It is the single place where the legacy
 * dialogs' defaults are preserved, so it is covered directly by unit tests.
 *
 * Each entry mirrors the *default output* of the dialog it replaces, so a
 * context-menu click lands the user in the unified command dialog with the same
 * starting expression the old dialog would have produced.
 */
import type {
  CommandDialogType,
  CommandEntryContext,
  NumberTransformKind,
  PadKind,
  SliceKind,
  TextTransformKind,
} from "@/types/dialog";

/** Mirrors the legacy `TextTransformDialog` expression map. */
const TEXT_TRANSFORMS: Record<TextTransformKind, (col: string) => string> = {
  len: (col) => `col("${col}").len() as "${col}"`,
  lower: (col) => `col("${col}").lower() as "${col}"`,
  upper: (col) => `col("${col}").upper() as "${col}"`,
  trim: (col) => `col("${col}").trim() as "${col}"`,
  ltrim: (col) => `col("${col}").ltrim() as "${col}"`,
  rtrim: (col) => `col("${col}").rtrim() as "${col}"`,
  // NB: the legacy dialog wrote this as a template literal with `\r\t\n`, which
  // JS expanded into *literal* control characters inside the emitted regex —
  // so the generated xan expression embedded a raw newline. Escaping them keeps
  // the same intent ("strip CR/TAB/LF") and stays parseable.
  strip: (col) => `replace(col("${col}"), /[\\r\\t\\n]/, "") as "${col}"`,
};

/** Mirrors the legacy `NumberTransformDialog` expression map. */
const NUMBER_TRANSFORMS: Record<NumberTransformKind, (col: string) => string> =
  {
    abs: (col) => `abs(col("${col}")) as "${col}"`,
    neg: (col) => `neg(col("${col}")) as "${col}"`,
    floor: (col) => `floor(col("${col}")) as "${col}"`,
    ceil: (col) => `ceil(col("${col}")) as "${col}"`,
    int: (col) => `trunc(col("${col}")) as "${col}"`,
    float: (col) => `float(col("${col}")) as "${col}"`,
    round: (col) => `to_fixed(round(col("${col}"), 0.01), 2) as "${col}"`,
  };

/**
 * Slice/pad defaults come straight from the legacy dialogs' initial state
 * (`leftLength`/`rightLength` 4, `sliceStart` 0 / `sliceEnd` 4, `sep` "/",
 * `outputColumnName` "new_col", pad `width` 10, no pad char).
 */
const SLICE_SEPARATOR = "/";
const SLICE_OUTPUT_COLUMN = "new_col";

function sliceExpression(kind: SliceKind, col: string): string {
  const ref = `col("${col}")`;
  switch (kind) {
    case "left":
      return `${ref}[:4]`;
    case "right":
      return `${ref}[-4:]`;
    case "slice":
      return `${ref}[0:4]`;
    case "split":
      return `split(${ref}, "${SLICE_SEPARATOR}")`;
  }
}

function padExpression(kind: PadKind, col: string): string {
  // Legacy `PadDialog` default: width 10, empty pad character.
  return `${kind}(col("${col}"), 10) as "${col}"`;
}

/** Resolves the right-clicked column index to its header name. */
function resolveColumn(context: CommandEntryContext): string | undefined {
  if (context.col === undefined) return undefined;
  const name = context.headers?.[context.col];
  return name ? name : undefined;
}

/**
 * Builds the initial parameters for `type` from a canvas entry context.
 *
 * Returns `{}` when the target command has nothing sensible to prefill — the
 * dialog then opens on the command's own defaults.
 */
export function buildCommandInitialParams(
  type: CommandDialogType,
  context: CommandEntryContext = {},
): Record<string, any> {
  const column = resolveColumn(context);

  switch (type) {
    // Right-click → Filter (text): the legacy dialog defaulted to text mode and
    // built a `search` command scoped to the column.
    case "search":
      return column ? { select: column } : {};

    // Right-click → Filter (number): legacy number mode built a `filter`
    // expression comparing the column.
    case "filter":
      return column ? { expression: `col("${column}") == 0` } : {};

    // Right-click → Sort: legacy preselects the clicked column, ascending, as
    // text, and keeps an empty output path.
    case "sort":
      return column
        ? { select: column, reverse: false, numeric: false, output: "" }
        : { output: "" };

    // Text / number / date / slice / pad / replace all resolve to the `map`
    // command; the context says which scaffold to start from.
    case "map": {
      if (!column) return { output: "", overwrite: false };
      const { textTransform, numberTransform, slice, pad, mapScaffold } =
        context;
      if (textTransform) {
        return {
          expression: TEXT_TRANSFORMS[textTransform](column),
          overwrite: true,
          output: "",
        };
      }
      if (numberTransform) {
        return {
          expression: NUMBER_TRANSFORMS[numberTransform](column),
          overwrite: true,
          output: "",
        };
      }
      if (slice) {
        // Split writes into a new column by default; the others overwrite.
        return slice === "split"
          ? {
              expression: `${sliceExpression(slice, column)} as "${SLICE_OUTPUT_COLUMN}"`,
              overwrite: false,
              output: "",
            }
          : {
              expression: `${sliceExpression(slice, column)} as "${column}"`,
              overwrite: true,
              output: "",
            };
      }
      if (pad) {
        return {
          expression: padExpression(pad, column),
          overwrite: true,
          output: "",
        };
      }
      // Date transform: legacy default formats `%Y%m%d` → `%d/%m/%Y` into a new
      // column named `new_date`.
      if (mapScaffold === "date") {
        return {
          expression: `strftime(datetime(col("${column}"), "%Y%m%d"), "%d/%m/%Y") as "new_date"`,
          overwrite: false,
          output: "",
        };
      }
      if (mapScaffold === "replace") {
        return {
          expression: `replace(col("${column}"), "", "") as "${column}"`,
          overwrite: true,
          output: "",
        };
      }
      // Bare map entry: identity, so the user edits a valid expression.
      return {
        expression: `col("${column}") as "${column}"`,
        overwrite: true,
        output: "",
      };
    }

    // Right-click → Window: the legacy dialog started from an empty entry list.
    case "window":
      return { output: "" };

    default:
      return {};
  }
}
