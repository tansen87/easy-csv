import type { XanCommand } from "@/types/xan";
import {
  COMMAND_CATEGORY_VIEW,
  type CommandCategoryView,
} from "@/data/commands/categoryView";

/** Panel language, matching `useLanguage().effectiveLanguage`. */
export type CommandLanguage = "zh" | "en";

export interface CommandGroup {
  view: CommandCategoryView;
  commands: XanCommand[];
  /** The whole group is shown because the query matched its label. */
  byCategory: boolean;
}

export interface CommandSearch {
  /** Non-empty groups, in catalog order. */
  groups: CommandGroup[];
  /** Visible commands per category key; the rail prints 0 for the misses. */
  counts: Record<string, number>;
  hits: number;
  total: number;
}

/**
 * Split on whitespace so `排序 金额` narrows instead of widening: every token
 * has to match the same command. Chinese has no word separators, so this is
 * plain substring matching after that.
 */
export function tokenize(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * What a query is matched against: the command name, the description in the
 * current language, and the category (raw English key plus both labels).
 *
 * The old list matched `name`, the current description and the raw category -
 * so typing a Chinese word that only appeared in a category label found
 * nothing. Labels are in here for exactly that reason.
 */
function searchableText(command: XanCommand, language: CommandLanguage): string {
  const description =
    language === "zh" ? command.descriptionCn : command.description;
  return `${command.name}\n${description}`.toLowerCase();
}

function categoryText(view: CommandCategoryView): string {
  return `${view.key} ${view.label.zh} ${view.label.en}`.toLowerCase();
}

/**
 * Filter the catalog and group it for display (design 072).
 *
 * A query that names a category (`排序`, `plugin`) shows that whole group -
 * browsing intent, not a search for one command - and `byCategory` lets the
 * header print `n/n` instead of pretending every row matched.
 */
export function searchCommands(
  commands: XanCommand[],
  query: string,
  language: CommandLanguage,
): CommandSearch {
  const tokens = tokenize(query);
  const buckets = new Map<string, XanCommand[]>();
  for (const command of commands) {
    const bucket = buckets.get(command.category);
    if (bucket) bucket.push(command);
    else buckets.set(command.category, [command]);
  }

  // Unknown categories still show up (at the end) instead of vanishing: a new
  // command file must not become invisible just because this list is behind.
  const views: CommandCategoryView[] = [...COMMAND_CATEGORY_VIEW];
  for (const key of buckets.keys()) {
    if (views.some((view) => view.key === key)) continue;
    views.push({ key, index: "", label: { zh: key, en: key } });
  }

  const groups: CommandGroup[] = [];
  const counts: Record<string, number> = {};
  let hits = 0;

  for (const view of views) {
    const all = buckets.get(view.key) ?? [];
    if (all.length === 0) continue;

    const byCategory =
      tokens.length > 0 && tokens.every((t) => categoryText(view).includes(t));
    const matched = byCategory
      ? all
      : all.filter((command) => {
          const text = searchableText(command, language);
          return tokens.every((t) => text.includes(t));
        });

    counts[view.key] = matched.length;
    if (matched.length === 0) continue;

    hits += matched.length;
    groups.push({ view, commands: matched, byCategory });
  }

  return { groups, counts, hits, total: commands.length };
}
