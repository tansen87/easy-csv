import { invoke } from "@tauri-apps/api/core";
import { DuckdbTableInfo, TabularFormat } from "@/types/xan";

/**
 * Single source of truth for "what kind of data file is this" (design 024).
 * The backend's `detect_input_format` treats unknown extensions as CSV; the
 * frontend is stricter — unknown extensions return `null` and keep the old
 * "please use the from command" behaviour.
 */

const CSV_EXTENSIONS = ["csv", "txt", "tsv"];
const PARQUET_EXTENSIONS = ["parquet"];
const DUCKDB_EXTENSIONS = ["duckdb", "ddb", "db"];

export function detectTabularFormat(filePath: string): TabularFormat | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (CSV_EXTENSIONS.includes(ext)) return "csv";
  if (PARQUET_EXTENSIONS.includes(ext)) return "parquet";
  if (DUCKDB_EXTENSIONS.includes(ext)) return "duckdb";
  return null;
}

export function isCsvFile(filePath: string): boolean {
  return detectTabularFormat(filePath) === "csv";
}

/**
 * Qualified table reference for SQL: `schema.table` outside `main`, plain
 * `table` otherwise. The backend splits on `.` and quotes each part.
 */
export function duckdbTableName(info: DuckdbTableInfo): string {
  return info.schema && info.schema !== "main"
    ? `${info.schema}.${info.name}`
    : info.name;
}

/** List the user tables / views of a `.duckdb` file (read-only). */
export async function listDuckdbTables(
  filePath: string,
): Promise<DuckdbTableInfo[]> {
  return invoke<DuckdbTableInfo[]>("list_duckdb_tables", { path: filePath });
}
