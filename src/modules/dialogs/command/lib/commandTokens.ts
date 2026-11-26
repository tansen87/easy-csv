import type { EffectiveLanguage } from "@/i18n/translations/types";
import type { XanCommand } from "@/types/xan";
import { paramHasValue, paramLabel } from "@/modules/dialogs/command/lib/paramMeta";

/** One piece of the command line, as the sheet shows it. */
export interface CommandToken {
  /** Parameter name; the key into `commandDialog.params`. */
  name: string;
  /** Human label, for the editor card and the chip's tooltip. */
  label: string;
  /** `--flag`, or empty for a positional parameter. */
  flag: string;
  /** Rendered value; empty for a flag. */
  value: string;
  isFlag: boolean;
}

/** Values with whitespace are quoted so a copied line can be pasted as-is. */
function quote(value: string): string {
  return /[\s"']/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/**
 * The parameters that are actually on the command line, in definition order.
 *
 * Same rules as `src-tauri/src/pipeline.rs`: `true` becomes a bare `--flag`,
 * a positional parameter contributes only its value, everything else is
 * `--name value`. Keeping this in one place means the sheet, the copy button
 * and the real run never disagree about what will execute.
 */
export function buildCommandTokens(
  command: XanCommand,
  params: Record<string, unknown>,
  language: EffectiveLanguage = "zh",
): CommandToken[] {
  const tokens: CommandToken[] = [];
  for (const param of command.parameters) {
    const raw = params[param.name];
    if (!paramHasValue(param, raw)) continue;
    const base = {
      name: param.name,
      label: paramLabel(command, param, language),
    };
    if (param.type === "flag") {
      tokens.push({ ...base, flag: `--${param.name}`, value: "", isFlag: true });
      continue;
    }
    tokens.push({
      ...base,
      flag: param.isPositional ? "" : `--${param.name}`,
      // `serializeStepParams` pipe-joins arrays, and the backend splits a
      // positional argument on `|`, so the preview shows the same separator.
      value: Array.isArray(raw) ? raw.join("|") : String(raw),
      isFlag: false,
    });
  }
  return tokens;
}

/** The full line, ready for the clipboard. */
export function commandLineText(
  command: XanCommand,
  params: Record<string, unknown>,
): string {
  const parts = ["xan", command.name];
  for (const token of buildCommandTokens(command, params)) {
    if (token.isFlag) parts.push(token.flag);
    else if (!token.flag) parts.push(quote(token.value));
    else parts.push(token.flag, quote(token.value));
  }
  return parts.join(" ");
}
