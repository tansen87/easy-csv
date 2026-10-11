import { describe, it, expect } from "vitest";

import {
  countMatches,
  filterSettings,
  highlightSegments,
  parseQuery,
  type SearchableGroup,
} from "@/utils/settingsSearch";

/**
 * The settings search contract (design 030 §4.3). It is a pure function, so
 * this is the cheapest and most complete place to pin the rules down.
 */

const groups: SearchableGroup[] = [
  {
    id: "appearance",
    name: "Appearance",
    rows: [
      {
        id: "theme",
        title: "Theme",
        description: "Interface colours",
        keywords: ["dark", "light"],
      },
      {
        id: "language",
        title: "Language",
        description: "Interface language",
      },
    ],
  },
  {
    id: "window",
    name: "Window",
    rows: [
      { id: "tray", title: "Tray", description: "Minimize to tray on close" },
      {
        id: "notification",
        title: "Notification",
        description: "Show a notification when a run completes",
      },
    ],
  },
  {
    id: "plugins",
    name: "Plugins",
    groupKeywords: ["plugin", "xan"],
    rows: [],
    summary: "plugins",
  },
];

const idsOf = (result: SearchableGroup[]) =>
  result.map((group) => ({
    group: group.id,
    rows: group.rows.map((row) => row.id),
  }));

describe("parseQuery", () => {
  it("splits on whitespace, lowercases and drops empties", () => {
    expect(parseQuery("  Tray   Dark ")).toEqual(["tray", "dark"]);
    expect(parseQuery("")).toEqual([]);
    expect(parseQuery("   ")).toEqual([]);
  });
});

describe("filterSettings", () => {
  it("returns the input untouched for an empty query", () => {
    expect(filterSettings(groups, "")).toBe(groups);
    expect(filterSettings(groups, "   ")).toBe(groups);
  });

  it("matches the title", () => {
    expect(idsOf(filterSettings(groups, "tray"))).toEqual([
      { group: "window", rows: ["tray"] },
    ]);
  });

  it("matches the description", () => {
    expect(idsOf(filterSettings(groups, "complete"))).toEqual([
      { group: "window", rows: ["notification"] },
    ]);
  });

  it("matches an alias from `keywords` — the reason they exist", () => {
    // "dark" is nowhere in the Theme row's visible text.
    expect(idsOf(filterSettings(groups, "dark"))).toEqual([
      { group: "appearance", rows: ["theme"] },
    ]);
  });

  it("is case-insensitive", () => {
    expect(idsOf(filterSettings(groups, "TRAY"))).toEqual(
      idsOf(filterSettings(groups, "tray")),
    );
  });

  it("requires every term (AND), not any", () => {
    // "tray" alone hits one row, "notification" alone another; together none.
    expect(filterSettings(groups, "tray notification")).toEqual([]);
    // Both terms are in the same row here.
    expect(idsOf(filterSettings(groups, "tray minimize"))).toEqual([
      { group: "window", rows: ["tray"] },
    ]);
  });

  it("keeps a group whose name matches, with all of its rows", () => {
    // A category name is a legitimate query, and for a panel-only group it is
    // the only way in.
    expect(idsOf(filterSettings(groups, "Appearance"))).toEqual([
      { group: "appearance", rows: ["theme", "language"] },
    ]);
  });

  it("finds the panel-only group through its group name / aliases", () => {
    expect(filterSettings(groups, "Plugins").map((g) => g.id)).toEqual([
      "plugins",
    ]);
    expect(filterSettings(groups, "xan").map((g) => g.id)).toEqual(["plugins"]);
  });

  it("drops groups with no match and keeps the original order", () => {
    const result = filterSettings(groups, "interface");
    expect(result.map((group) => group.id)).toEqual(["appearance"]);
    // Two terms that live in different rows do not add up: the AND is per row.
    expect(filterSettings(groups, "tray interface")).toEqual([]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterSettings(groups, "zzz")).toEqual([]);
  });
});

describe("countMatches", () => {
  it("counts rows, and a panel as one", () => {
    expect(countMatches(groups)).toBe(5);
    expect(countMatches(filterSettings(groups, "tray"))).toBe(1);
    expect(countMatches(filterSettings(groups, "plugins"))).toBe(1);
  });
});

describe("highlightSegments", () => {
  it("marks the matched span and leaves the rest alone", () => {
    expect(highlightSegments("Minimize to tray", "tray")).toEqual([
      { text: "Minimize to ", hit: false },
      { text: "tray", hit: true },
    ]);
  });

  it("marks every occurrence, case-insensitively", () => {
    expect(highlightSegments("Tray tray", "tray")).toEqual([
      { text: "Tray", hit: true },
      { text: " ", hit: false },
      { text: "tray", hit: true },
    ]);
  });

  it("marks each term of a multi-term query", () => {
    expect(highlightSegments("clear history", "clear history")).toEqual([
      { text: "clear", hit: true },
      { text: " ", hit: false },
      { text: "history", hit: true },
    ]);
  });

  it("merges overlapping matches", () => {
    expect(highlightSegments("abcd", "abc bcd")).toEqual([
      { text: "abcd", hit: true },
    ]);
  });

  it("returns a single non-hit segment when nothing matches", () => {
    expect(highlightSegments("Theme", "tray")).toEqual([
      { text: "Theme", hit: false },
    ]);
    expect(highlightSegments("Theme", "")).toEqual([
      { text: "Theme", hit: false },
    ]);
  });

  it("treats the query as literal text, not a pattern", () => {
    // A regex would explode on "("; the matcher must not build one.
    expect(highlightSegments("a(b", "(")).toEqual([
      { text: "a", hit: false },
      { text: "(", hit: true },
      { text: "b", hit: false },
    ]);
    expect(highlightSegments("a*b", "*")).toEqual([
      { text: "a", hit: false },
      { text: "*", hit: true },
      { text: "b", hit: false },
    ]);
  });

  it("handles an empty string", () => {
    expect(highlightSegments("", "tray")).toEqual([{ text: "", hit: false }]);
  });
});
