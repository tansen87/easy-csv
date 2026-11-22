import { describe, expect, it } from "vitest";

import { commandCategories, xanCommands } from "@/data/commands";
import { COMMAND_CATEGORY_VIEW } from "@/data/commands/categoryView";
import type { XanCommand } from "@/types/xan";
import { searchCommands, tokenize } from "@/modules/logs/lib/commandSearch";

describe("tokenize", () => {
  it("splits on whitespace and lowercases", () => {
    expect(tokenize("  SORT   name ")).toEqual(["sort", "name"]);
  });

  it("returns no tokens for an empty query", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("category view", () => {
  it("covers exactly the categories commands are filed under", () => {
    const viewKeys = COMMAND_CATEGORY_VIEW.map((view) => view.key).sort();
    expect(viewKeys).toEqual([...commandCategories].sort());
  });

  it("numbers the groups 01–14 in display order", () => {
    expect(COMMAND_CATEGORY_VIEW.map((view) => view.index)).toEqual(
      Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(2, "0")),
    );
  });

  it("starts at Explore and files Output late", () => {
    expect(COMMAND_CATEGORY_VIEW[0].key).toBe("Explore & visualize");
    expect(COMMAND_CATEGORY_VIEW[COMMAND_CATEGORY_VIEW.length - 4].key).toBe("Output");
  });
});

describe("searchCommands", () => {
  it("returns every command in catalog order for an empty query", () => {
    const result = searchCommands(xanCommands, "", "zh");
    expect(result.hits).toBe(xanCommands.length);
    expect(result.total).toBe(xanCommands.length);
    expect(result.groups[0].view.key).toBe("Explore & visualize");
    expect(result.groups[result.groups.length - 1].view.key).toBe("Plugins");
  });

  it("matches the command name", () => {
    const result = searchCommands(xanCommands, "groupby", "zh");
    expect(result.hits).toBe(1);
    expect(result.groups[0].commands[0].id).toBe("groupby");
  });

  it("matches the Chinese description", () => {
    const result = searchCommands(xanCommands, "拼音", "zh");
    expect(result.groups.map((group) => group.view.key)).toEqual(["Plugins"]);
    expect(result.groups[0].commands[0].id).toBe("pinyin");
  });

  it("shows the whole group when the query names the category", () => {
    // `去重` is both a label ("排序去重") and part of a description; browsing a
    // category beats picking the one row that happens to mention it.
    const result = searchCommands(xanCommands, "去重", "zh");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].view.key).toBe("Sort & deduplicate");
    expect(result.groups[0].byCategory).toBe(true);
    expect(result.groups[0].commands).toHaveLength(3);
    expect(result.hits).toBe(3);
  });

  it("narrows with every token instead of widening", () => {
    const one = searchCommands(xanCommands, "window", "zh");
    const two = searchCommands(xanCommands, "window zzzz", "zh");
    expect(one.hits).toBe(1);
    expect(two.hits).toBe(0);
  });

  it("counts misses per category without dropping the group", () => {
    const result = searchCommands(xanCommands, "pivot", "zh");
    expect(result.counts["Explore & visualize"]).toBe(0);
    expect(result.counts["Transpose & pivot"]).toBeGreaterThan(0);
    expect(result.groups.every((group) => group.commands.length > 0)).toBe(true);
  });

  it("keeps a command whose category is missing from the view list", () => {
    const stray: XanCommand = {
      id: "stray",
      name: "stray",
      description: "Stray command",
      descriptionCn: "走失的命令",
      category: "Future stuff",
      parameters: [],
    };
    const result = searchCommands([...xanCommands, stray], "", "zh");
    expect(result.groups[result.groups.length - 1].view.key).toBe("Future stuff");
    expect(result.hits).toBe(xanCommands.length + 1);
  });
});
