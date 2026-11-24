import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import type { StepLineage } from "@/types/xan";

/**
 * 「datalineage → more → Export JSONL」writes one JSON object per line (design 045/076).
 *
 * Lineage is a flat list of records — one step, one line — so JSONL beats a
 * JSON array here: `tail -f` works, `jq -c` streams, a diff of two exports only
 * touches the steps that changed, and an Excel/BI importer can read it row by
 * row without loading the whole file.
 *
 * (It used to call `save_lineage_data`, which silently wrote
 * `<data dir>/lineage/<tabId>.json` and never told the user anything — the menu
 * item looked dead. The caller owns the toast so it can say where the file went.)
 */

/** One compact object per record, newline-terminated (JSONL, not JSON). */
export function toJsonl(records: unknown[]): string {
  if (records.length === 0) return "";
  return records.map((record) => JSON.stringify(record)).join("\n") + "\n";
}

export async function exportLineageJsonl(
  lineage: StepLineage[],
  defaultFileName: string,
): Promise<string | null> {
  const filePath = await save({
    filters: [{ name: "JSON Lines", extensions: ["jsonl"] }],
    defaultPath: defaultFileName,
  });
  if (!filePath) return null;

  await writeFile(filePath, new TextEncoder().encode(toJsonl(lineage)));
  return filePath;
}

/** `销售分析.lineage.jsonl` — strips what a file picker cannot take on Windows. */
export const lineageFileName = (tabName: string) =>
  `${tabName.replace(/[\\/:*?"<>|]+/g, "-").trim() || "lineage"}.lineage.jsonl`;
