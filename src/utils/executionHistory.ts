/**
 * Pure logic for F6 execution history: stable pipeline snapshot hashing and
 * stdout → summary stats (rows/columns/bytes/preview). Never stores full
 * stdout, keeping each persisted record small.
 */
import { PipelineEdge, StoredPipelineStep } from "@/types/xan";
import { parseCsvString } from "@/utils/csv";

/** Small stable string hash (cyrb53). Deterministic across runs. */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Stable hash of the pipeline structure (steps + edges) as persisted by the
 * version system, so history records can be matched to a saved version.
 */
export function computePipelineSnapshotHash(
  steps: StoredPipelineStep[],
  edges: PipelineEdge[],
): string {
  const sortedSteps = [...steps].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...edges].sort((a, b) =>
    `${a.source}->${a.target}`.localeCompare(`${b.source}->${b.target}`),
  );
  return hashString(
    JSON.stringify({
      steps: sortedSteps.map((s) => ({
        id: s.id,
        commandId: s.commandId,
        parameters: s.parameters,
        alias: s.alias,
      })),
      edges: sortedEdges,
    }),
  );
}

export interface OutputSummary {
  columns: number;
  rows: number;
  bytes: number;
  preview: string[];
}

/** Preview length cap kept in the summary. */
const PREVIEW_LINES = 3;

/**
 * Build a compact summary from the successful branch outputs.
 * Rows are counted by parsing the CSV outputs (quote-aware); bytes use the
 * UTF-8 byte length; preview holds the first non-empty output lines.
 */
export function buildOutputSummary(
  outputs: Array<{ success: boolean; output?: string }>,
): OutputSummary {
  let columns = 0;
  let rows = 0;
  let bytes = 0;
  let preview: string[] = [];

  for (const r of outputs) {
    if (!r.success || !r.output?.trim()) continue;
    const text = r.output.trim();
    bytes += new TextEncoder().encode(text).length;
    const parsed = parseCsvString(text);
    if (parsed.headers.length > columns) columns = parsed.headers.length;
    rows += parsed.rows.length;
    if (preview.length === 0) {
      preview = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, PREVIEW_LINES);
    }
  }

  return { columns, rows, bytes, preview };
}
