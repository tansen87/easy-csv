import { describe, expect, it } from "vitest";

import {
  buildCommandTokens,
  commandLineText,
} from "@/modules/dialogs/command/lib/commandTokens";
import type { XanCommand } from "@/types/xan";

const command: XanCommand = {
  id: "demo",
  name: "demo",
  description: "",
  descriptionCn: "",
  category: "test",
  parameters: [
    { name: "columns", type: "string", description: "", required: true, isPositional: true },
    { name: "input1", type: "string", description: "", required: true, isPositional: true },
    { name: "flag", type: "flag", description: "", required: false },
    { name: "select", type: "string", description: "", required: false },
    { name: "extra", type: "string", description: "", required: false },
  ],
};

describe("buildCommandTokens", () => {
  it("follows declaration order and skips parameters without a value", () => {
    const tokens = buildCommandTokens(command, {
      columns: "地区",
      input1: "客户.csv",
      flag: true,
      select: "",
      extra: "   ",
    });

    expect(tokens.map((token) => token.name)).toEqual([
      "columns",
      "input1",
      "flag",
    ]);
    expect(tokens[0].flag).toBe("");
    expect(tokens[2].isFlag).toBe(true);
  });

  it("keeps the human label for the editor and the positional fallback", () => {
    const [columns] = buildCommandTokens(command, { columns: "地区" });
    expect(columns.label).toBe("列");
  });
});

describe("commandLineText", () => {
  it("mirrors the argv the backend builds", () => {
    expect(
      commandLineText(command, {
        columns: "地区",
        input1: "客户.csv",
        flag: true,
        select: "a,b",
      }),
    ).toBe("xan demo 地区 客户.csv --flag --select a,b");
  });

  it("quotes values that contain whitespace so the line can be pasted", () => {
    expect(commandLineText(command, { input1: "my file.csv" })).toBe(
      'xan demo "my file.csv"',
    );
  });

  it("escapes an embedded double quote", () => {
    expect(commandLineText(command, { input1: 'a"b.csv' })).toBe(
      'xan demo "a\\"b.csv"',
    );
  });
});
