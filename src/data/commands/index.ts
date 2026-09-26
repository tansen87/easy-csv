import { XanCommand } from "@/types/xan";
import { customCommands } from "./custom";
import { exploreCommands } from "./explore";
import { transformCommands } from "./transform";
import { searchFilterCommands } from "./searchFilter";
import { sortDedupCommands } from "./sortDedup";
import { aggregateCommands } from "./aggregate";
import { combineCommands } from "./combine";
import { formatCommands } from "./format";
import { transposePivotCommands } from "./transposePivot";
import { partitionCommands } from "./partition";
import { generateCommands } from "./generate";
import { scriptingCommands } from "./scripting";
import { pluginsCommands } from "./plugins";

/**
 * All xan commands, in the canonical order the command list renders them.
 *
 * Split out of the former 4,188-line `data/commands.ts` (design 019 §4.5);
 * this barrel keeps `@/data/commands` working unchanged — `commands.test.ts`
 * covers all 59 commands through it and is deliberately left untouched.
 */
export const xanCommands: XanCommand[] = [
  ...customCommands,
  ...exploreCommands,
  ...transformCommands,
  ...searchFilterCommands,
  ...sortDedupCommands,
  ...aggregateCommands,
  ...combineCommands,
  ...formatCommands,
  ...transposePivotCommands,
  ...partitionCommands,
  ...generateCommands,
  ...scriptingCommands,
  ...pluginsCommands,
];

export const commandCategories = [
  "Output",
  "Explore & visualize",
  "Search & filter",
  "Sort & deduplicate",
  "Aggregate",
  "Combine multiple CSV files",
  "Add, transform, drop and move columns",
  "Format, convert & recombobulate",
  "Transpose & pivot",
  "Split a CSV file into multiple",
  "Generate CSV files",
  "Scripting",
  "Batch method",
  "Plugins",
];
