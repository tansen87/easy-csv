import { describe, it, expect } from "vitest";
import { relativeStamp } from "@/utils/format";

/**
 * `relativeStamp` feeds the version log's timestamp column.
 *
 * Versions are stored as a bare local `YYYY-MM-DD HH:mm:ss`, a shape that
 * `new Date()` reads as UTC on some engines — hence the manual parse. These
 * cases pin the four templates and the fallback.
 */
describe("relativeStamp", () => {
  const now = new Date(2026, 10, 7, 20, 30, 0);

  it("returns the clock for today", () => {
    expect(relativeStamp("2026-11-07 09:05:12", now)).toEqual({
      kind: "today",
      clock: "09:05",
    });
  });

  it("returns the clock for yesterday", () => {
    expect(relativeStamp("2026-11-06 23:59:59", now)).toEqual({
      kind: "yesterday",
      clock: "23:59",
    });
  });

  it("drops the year within the same year", () => {
    expect(relativeStamp("2026-11-04 10:15:00", now)).toEqual({
      kind: "date",
      month: 11,
      day: 4,
    });
  });

  it("keeps the year across years", () => {
    expect(relativeStamp("2025-12-31 08:00:00", now)).toEqual({
      kind: "dateYear",
      year: 2025,
      month: 12,
      day: 31,
    });
  });

  it("reads a future stamp (clock skew) as today instead of tomorrow", () => {
    expect(relativeStamp("2026-11-08 01:00:00", now)).toEqual({
      kind: "today",
      clock: "01:00",
    });
  });

  it("returns null for anything it cannot parse", () => {
    expect(relativeStamp("", now)).toBeNull();
    expect(relativeStamp("not a date", now)).toBeNull();
  });
});
