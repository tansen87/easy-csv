import type { QuickActionRequest } from "@/modules/dialogs/quick/types";

/**
 * Header scope for a quick-action panel: the column index as it appears in the
 * table (`03`) plus the column name, matching the index slips on the canvas.
 * Returns `undefined` when the action is not about one column.
 */
export function quickScope(
  request: Pick<QuickActionRequest, "headers">,
  column?: string,
): string | undefined {
  if (!column) return undefined;
  const index = request.headers.indexOf(column);
  if (index < 0) return column;
  return `${String(index + 1).padStart(2, "0")} · ${column}`;
}
