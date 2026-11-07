import { describe, it, expect } from "vitest";
import { formatShortDateTime } from "@/utils/format";

describe("formatShortDateTime", () => {
  it("turns the stored timestamp into MM-DD HH:mm", () => {
    expect(formatShortDateTime("2026-11-06 14:32:00")).toBe("11-06 14:32");
  });

  it("keeps the time when there are no seconds", () => {
    expect(formatShortDateTime("2026-01-02 09:05")).toBe("01-02 09:05");
  });

  it("returns anything that does not match untouched", () => {
    expect(formatShortDateTime("")).toBe("");
    expect(formatShortDateTime("just now")).toBe("just now");
  });
});
