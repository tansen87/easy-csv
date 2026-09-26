import type { PipelineTab } from "@/types/xan";

/**
 * Delimiter a run should use. The tab's own resolved delimiter wins — it is
 * what the preview table was read with — and the global setting only covers
 * tabs that were never read. Keeps "what you see is what runs" (design 018).
 *
 * Pure helper: kept name/behavior identical to the previous inline useCallback.
 */
export function resolveRunDelimiter(
  tab: PipelineTab | undefined,
  defaultDelimiter: string,
): string {
  return tab?.defaultDelimiter || defaultDelimiter;
}
