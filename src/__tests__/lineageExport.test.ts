import { beforeEach, describe, expect, it, vi } from "vitest";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import type { StepLineage } from "@/types/xan";
import {
  exportLineageJsonl,
  lineageFileName,
  toJsonl,
} from "@/utils/lineageExport";

/**
 * Regression for "导出血缘 JSON 没反应": the menu used to call a command that
 * wrote into the app data dir with no dialog and no toast. It now asks for a
 * path and writes JSONL — one step per line, so `jq -c`, `tail -f` and diffs of
 * two exports all work.
 */
const lineage = [
  { stepId: "s1", index: 1 },
  { stepId: "s2", index: 2 },
] as unknown as StepLineage[];

describe("toJsonl", () => {
  it("writes one compact object per line and ends with a newline", () => {
    expect(toJsonl([{ a: 1 }, { b: [1, 2] }])).toBe(
      '{"a":1}\n{"b":[1,2]}\n',
    );
  });

  it("writes an empty file for an empty list", () => {
    expect(toJsonl([])).toBe("");
  });
});

describe("exportLineageJsonl", () => {
  beforeEach(() => {
    vi.mocked(save).mockReset();
    vi.mocked(writeFile).mockReset();
  });

  it("asks for a .jsonl path and writes one record per line", async () => {
    vi.mocked(save).mockResolvedValue("C:/out/sales.lineage.jsonl");

    const path = await exportLineageJsonl(lineage, "sales.lineage.jsonl");

    expect(path).toBe("C:/out/sales.lineage.jsonl");
    expect(vi.mocked(save)).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: "sales.lineage.jsonl",
        filters: [{ name: "JSON Lines", extensions: ["jsonl"] }],
      }),
    );
    const [target, bytes] = vi.mocked(writeFile).mock.calls[0];
    expect(target).toBe("C:/out/sales.lineage.jsonl");
    expect(new TextDecoder().decode(bytes as Uint8Array)).toBe(
      '{"stepId":"s1","index":1}\n{"stepId":"s2","index":2}\n',
    );
  });

  it("writes nothing when the dialog is cancelled", async () => {
    vi.mocked(save).mockResolvedValue(null);

    expect(await exportLineageJsonl(lineage, "sales.jsonl")).toBeNull();
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe("lineageFileName", () => {
  it("keeps a readable tab name", () => {
    expect(lineageFileName("销售分析")).toBe("销售分析.lineage.jsonl");
  });

  it("replaces characters the file picker rejects", () => {
    expect(lineageFileName("a/b:c")).toBe("a-b-c.lineage.jsonl");
  });

  it("falls back when the tab has no name", () => {
    expect(lineageFileName("  ")).toBe("lineage.lineage.jsonl");
  });
});
