import { describe, it, expect } from "vitest";
import {
  buildInstantColumnAction,
  isInstantColumnAction,
} from "@/modules/dialogs/quick/lib/instantColumnAction";

describe("buildInstantColumnAction", () => {
  it("maps empty-value actions to search flags", () => {
    expect(buildInstantColumnAction("search-empty", "phone")).toEqual({
      type: "search",
      params: { select: "phone", empty: true },
    });
    expect(buildInstantColumnAction("search-non-empty", "phone")).toEqual({
      type: "search",
      params: { select: "phone", "non-empty": true },
    });
  });

  it("maps the remaining column actions to their commands", () => {
    expect(buildInstantColumnAction("dedup-column", "phone")).toMatchObject({
      type: "dedup",
      params: { select: "phone" },
    });
    expect(buildInstantColumnAction("blank-column", "city")).toMatchObject({
      type: "blank",
      params: { select: "city" },
    });
    expect(buildInstantColumnAction("drop-column", "amount")).toMatchObject({
      type: "drop",
      params: { selection: "amount" },
    });
    expect(buildInstantColumnAction("keep-column", "amount")).toMatchObject({
      type: "select",
      params: { selection: "amount" },
    });
  });

  it("returns null without a column", () => {
    expect(buildInstantColumnAction("drop-column", "")).toBeNull();
  });

  it("distinguishes instant kinds from dialog kinds", () => {
    expect(isInstantColumnAction("dedup-column")).toBe(true);
    expect(isInstantColumnAction("fill")).toBe(false);
    expect(isInstantColumnAction("copy-column")).toBe(false);
    expect(isInstantColumnAction("sort")).toBe(false);
  });
});
