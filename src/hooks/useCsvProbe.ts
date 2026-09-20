import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/** One candidate delimiter's score, as reported by the backend. */
export interface DelimiterCandidate {
  delimiter: string;
  header_fields: number;
  fields: number;
  consistent: boolean;
  score: number;
}

/**
 * Result of probing the head of a CSV file.
 * Mirrors `CsvProbe` in `src-tauri/src/csv.rs`.
 */
export interface CsvProbe {
  path: string;
  /** Delimiter `columns` / `header` / `sample_rows` were computed with. */
  delimiter: string;
  source: "detected" | "forced" | "fallback";
  confidence: "high" | "low" | "none";
  /** Field count of the first record — "the first row's column count". */
  columns: number;
  header: string[];
  sample_rows: string[][];
  sampled_records: number;
  truncated: boolean;
  quoting_used: boolean;
  candidates: DelimiterCandidate[];
}

export interface UseCsvProbeOptions {
  /** File to inspect; an empty string disables probing. */
  inputFile: string;
  /** `null`/`""` → auto-detect; otherwise force this delimiter. */
  delimiter?: string | null;
  /** Used by the backend when detection is inconclusive. */
  fallbackDelimiter?: string;
  skiprows?: number;
  quoting?: boolean;
  previewRows?: number;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseCsvProbeResult {
  probe: CsvProbe | null;
  error: string | null;
  isProbing: boolean;
}

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * Inspect the head of a CSV file with debouncing and stale-response guarding:
 * only the newest request is allowed to write, so fast typing in the path field
 * cannot flash outdated column counts.
 */
export function useCsvProbe({
  inputFile,
  delimiter = null,
  fallbackDelimiter,
  skiprows = 0,
  quoting = true,
  previewRows = 3,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseCsvProbeOptions): UseCsvProbeResult {
  const path = inputFile.trim();
  const [probe, setProbe] = useState<CsvProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const seqRef = useRef(0);

  // A new file invalidates the previous file's numbers immediately; option
  // changes (skiprows/quoting/delimiter) keep them until the refresh lands.
  useEffect(() => {
    setProbe(null);
    setError(null);
  }, [path]);

  useEffect(() => {
    if (!enabled || !path) {
      seqRef.current += 1; // invalidate any in-flight request
      setIsProbing(false);
      return;
    }

    const seq = ++seqRef.current;
    setIsProbing(true);
    const timer = setTimeout(async () => {
      try {
        const data = await invoke<CsvProbe>("probe_csv_file", {
          path,
          delimiter: delimiter ? delimiter : null,
          fallbackDelimiter: fallbackDelimiter || null,
          skiprows,
          quoting,
          previewRows,
        });
        if (seqRef.current !== seq) return;
        setProbe(data);
        setError(null);
      } catch (err) {
        if (seqRef.current !== seq) return;
        setProbe(null);
        setError(String(err));
      } finally {
        if (seqRef.current === seq) setIsProbing(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [
    path,
    delimiter,
    fallbackDelimiter,
    skiprows,
    quoting,
    previewRows,
    enabled,
    debounceMs,
  ]);

  return { probe, error, isProbing };
}
