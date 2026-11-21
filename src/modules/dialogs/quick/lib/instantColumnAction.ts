import type { CommandDialogType, QuickActionKind } from "@/types/dialog";

/**
 * Column actions that run immediately from the header menu: no guided dialog,
 * one step (or one clipboard write) per click.
 */
export type InstantColumnActionKind = Extract<
  QuickActionKind,
  | "search-empty"
  | "search-non-empty"
  | "dedup-column"
  | "blank-column"
  | "drop-column"
  | "keep-column"
>;

const INSTANT_COLUMN_ACTIONS: InstantColumnActionKind[] = [
  "search-empty",
  "search-non-empty",
  "dedup-column",
  "blank-column",
  "drop-column",
  "keep-column",
];

export function isInstantColumnAction(
  kind: QuickActionKind,
): kind is InstantColumnActionKind {
  return INSTANT_COLUMN_ACTIONS.includes(kind as InstantColumnActionKind);
}

export interface InstantColumnResult {
  type: CommandDialogType;
  params: Record<string, unknown>;
}

/** Pure mapping from a header-menu action to its xan parameters. */
export function buildInstantColumnAction(
  kind: InstantColumnActionKind,
  column: string,
): InstantColumnResult | null {
  if (!column) return null;
  switch (kind) {
    case "search-empty":
      return { type: "search", params: { select: column, empty: true } };
    case "search-non-empty":
      return { type: "search", params: { select: column, "non-empty": true } };
    case "dedup-column":
      return { type: "dedup", params: { select: column } };
    case "blank-column":
      return { type: "blank", params: { select: column } };
    case "drop-column":
      return { type: "drop", params: { selection: column } };
    case "keep-column":
      return { type: "select", params: { selection: column } };
  }
}
