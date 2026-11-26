import { describe, expect, it } from "vitest";

import {
  isColumnParam,
  paramGroup,
  paramHasValue,
  paramLabel,
} from "@/modules/dialogs/command/lib/paramMeta";
import type { XanCommand, XanParameter } from "@/types/xan";

const param = (over: Partial<XanParameter> = {}): XanParameter => ({
  name: "value",
  type: "string",
  description: "A value",
  required: false,
  ...over,
});

const command = (id: string): XanCommand => ({
  id,
  name: id,
  description: "",
  descriptionCn: "",
  category: "test",
  parameters: [],
});

describe("paramGroup", () => {
  it("puts required params first regardless of type", () => {
    expect(paramGroup(param({ required: true, type: "flag" }))).toBe("required");
    expect(paramGroup(param({ required: true }))).toBe("required");
  });

  it("keeps flags and selects in 常用", () => {
    expect(paramGroup(param({ type: "flag" }))).toBe("common");
    expect(
      paramGroup(param({ type: "select", options: ["a", "b"] })),
    ).toBe("common");
  });

  it("treats a non-empty default as 常用", () => {
    expect(paramGroup(param({ default: "inner" }))).toBe("common");
  });

  it("keeps the primary free-text params in 常用", () => {
    expect(paramGroup(param({ name: "select" }))).toBe("common");
    expect(paramGroup(param({ name: "columns2" }))).toBe("common");
  });

  it("sends the rest of the optional strings to 高级", () => {
    expect(paramGroup(param({ name: "prefix-left" }))).toBe("advanced");
    expect(paramGroup(param({ name: "evaluate-file" }))).toBe("advanced");
  });
});

describe("paramHasValue", () => {
  it("counts a flag only when it is on", () => {
    const flag = param({ type: "flag" });
    expect(paramHasValue(flag, true)).toBe(true);
    expect(paramHasValue(flag, "true")).toBe(true);
    expect(paramHasValue(flag, false)).toBe(false);
    expect(paramHasValue(flag, undefined)).toBe(false);
  });

  it("ignores blank strings and null", () => {
    expect(paramHasValue(param(), "  ")).toBe(false);
    expect(paramHasValue(param(), "")).toBe(false);
    expect(paramHasValue(param(), null)).toBe(false);
    expect(paramHasValue(param(), "x")).toBe(true);
    expect(paramHasValue(param({ type: "number" }), 0)).toBe(true);
  });
});

describe("isColumnParam", () => {
  it("recognises the column-name parameters", () => {
    expect(isColumnParam(param({ name: "columns" }))).toBe(true);
    expect(isColumnParam(param({ name: "select" }))).toBe(true);
    expect(isColumnParam(param({ name: "input1" }))).toBe(false);
  });

  it("never treats a flag as a column", () => {
    expect(isColumnParam(param({ name: "select", type: "flag" }))).toBe(false);
  });
});

describe("paramLabel", () => {
  it("prefers the per-command label", () => {
    expect(paramLabel(command("join"), param({ name: "columns" }), "zh")).toBe(
      "连接列",
    );
    expect(paramLabel(command("dedup"), param({ name: "select" }), "zh")).toBe(
      "去重的列",
    );
  });

  it("describes an uncurated parameter with its own description", () => {
    expect(
      paramLabel(
        command("sort"),
        param({ name: "columns", descriptionCn: "按列名按字母顺序排序选定的列" }),
        "zh",
      ),
    ).toBe("按列名按字母顺序排序选定的列");
  });

  it("prefers the description over the generic name map", () => {
    // A global "列" would be wrong for `sort --columns`, which sorts columns.
    expect(
      paramLabel(
        command("sort"),
        param({ name: "columns", descriptionCn: "按列名排序" }),
        "zh",
      ),
    ).toBe("按列名排序");
  });

  it("falls back to the global name, then to the flag", () => {
    const bare = param({ name: "x", description: "", descriptionCn: "" });
    expect(paramLabel(command("unknown"), bare, "zh")).toBe("横轴列");
    expect(
      paramLabel(
        command("unknown"),
        param({ name: "prefix-left", description: "", descriptionCn: "" }),
        "zh",
      ),
    ).toBe("prefix-left");
  });

  it("answers in English when the UI is English", () => {
    expect(paramLabel(command("join"), param({ name: "columns" }), "en")).toBe(
      "Join columns",
    );
    expect(
      paramLabel(
        command("unknown"),
        param({ name: "x", description: "X axis", descriptionCn: "" }),
        "en",
      ),
    ).toBe("X axis");
  });
});
