import { describe, it, expect, vi } from "vitest";

import { matchItem, searchItems, SCORE } from "@/modules/logs/lib/scoreItem";
import type { PaletteItem } from "@/modules/logs/lib/paletteTypes";

const item = (
  patch: Partial<PaletteItem> & { label: string },
): PaletteItem => ({
  id: patch.label,
  group: "Commands",
  onSelect: vi.fn(),
  ...patch,
});

describe("matchItem", () => {
  it("scores exact > prefix > contains", () => {
    expect(matchItem(item({ label: "filter" }), "filter")?.score).toBe(
      SCORE.labelExact,
    );
    expect(matchItem(item({ label: "filter" }), "fi")?.score).toBe(
      SCORE.labelPrefix,
    );
    expect(matchItem(item({ label: "batch-filter" }), "fi")?.score).toBe(
      SCORE.labelContains,
    );
  });

  it("returns null when nothing matches", () => {
    expect(
      matchItem(item({ label: "filter", description: "筛选" }), "zzz"),
    ).toBeNull();
  });

  it("matches description, keywords, group and shortcut at the meta score", () => {
    expect(
      matchItem(item({ label: "dedup", description: "去重 CSV 文件" }), "去重")
        ?.score,
    ).toBe(SCORE.meta);
    expect(
      matchItem(
        item({ label: "select", keywords: "drop and move columns" }),
        "drop and move",
      )?.score,
    ).toBe(SCORE.meta);
    expect(
      matchItem(item({ label: "execute", shortcut: "Ctrl+R" }), "ctrl+r")
        ?.score,
    ).toBe(SCORE.meta);
  });

  it("reports every occurrence of the query in the description", () => {
    const m = matchItem(
      item({ label: "x", description: "去重 · 去重" }),
      "去重",
    );
    expect(m?.descRanges).toEqual([
      { start: 0, end: 2 },
      { start: 5, end: 7 },
    ]);
  });

  it("only highlights the label when the label is what matched", () => {
    const m = matchItem(item({ label: "filter", description: "筛选" }), "fi");
    expect(m?.labelRanges).toEqual([{ start: 0, end: 2 }]);
    expect(m?.descRanges).toEqual([]);
  });

  it("matches Chinese labels by pinyin initials", () => {
    expect(matchItem(item({ label: "打开文件" }), "dk")?.score).toBe(
      SCORE.initials,
    );
    // Initials never highlight: there is no visible run to paint.
    expect(matchItem(item({ label: "打开文件" }), "dk")?.labelRanges).toEqual(
      [],
    );
  });

  it("does not run initials on non-letter queries", () => {
    expect(matchItem(item({ label: "打开文件" }), "d1")).toBeNull();
  });

  it("treats an empty query as a match with no ranges", () => {
    expect(matchItem(item({ label: "打开文件" }), "  ")).toEqual({
      score: 0,
      labelRanges: [],
      descRanges: [],
    });
  });
});

describe("searchItems", () => {
  const items = [
    item({ label: "Open", group: "Actions", source: "action" }),
    item({ label: "filter", source: "command" }),
    item({ label: "finance_2025.csv", source: "file" }),
    item({ label: "batch-filter", source: "command" }),
    item({ label: "Hidden", disabled: true }),
  ];

  it("keeps the given order for an empty query and drops disabled entries", () => {
    expect(searchItems(items, "").map((r) => r.item.label)).toEqual([
      "Open",
      "filter",
      "finance_2025.csv",
      "batch-filter",
    ]);
  });

  it("puts commands before files when the score is equal", () => {
    expect(searchItems(items, "fi").map((r) => r.item.label)).toEqual([
      "filter",
      "finance_2025.csv",
      "batch-filter",
    ]);
  });

  it("returns nothing for a query that matches no entry", () => {
    expect(searchItems(items, "zzz")).toEqual([]);
  });
});
