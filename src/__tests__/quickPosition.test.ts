import { describe, it, expect } from "vitest";
import { computeAnchoredPosition } from "@/modules/dialogs/quick/lib/position";

const VIEWPORT = { width: 1000, height: 800 };
const SIZE = { width: 240, height: 300 };

describe("computeAnchoredPosition", () => {
  it("keeps the anchor when the dialog fits", () => {
    expect(
      computeAnchoredPosition({ x: 100, y: 120 }, SIZE, VIEWPORT),
    ).toEqual({ x: 100, y: 120 });
  });

  it("flips left when it would overflow the right edge", () => {
    expect(
      computeAnchoredPosition({ x: 900, y: 120 }, SIZE, VIEWPORT),
    ).toEqual({ x: 660, y: 120 });
  });

  it("flips above when it would overflow the bottom", () => {
    expect(
      computeAnchoredPosition({ x: 100, y: 700 }, SIZE, VIEWPORT),
    ).toEqual({ x: 100, y: 400 });
  });

  it("flips both ways in the bottom-right corner", () => {
    expect(
      computeAnchoredPosition({ x: 980, y: 780 }, SIZE, VIEWPORT),
    ).toEqual({ x: 740, y: 480 });
  });

  it("clamps to the margin when the flip would go negative", () => {
    expect(
      computeAnchoredPosition({ x: 10, y: 10 }, { width: 1200, height: 900 }, VIEWPORT),
    ).toEqual({ x: 8, y: 8 });
  });

  it("honours a custom margin", () => {
    expect(
      computeAnchoredPosition({ x: 990, y: 10 }, SIZE, VIEWPORT, 16),
    ).toEqual({ x: 744, y: 16 });
  });
});
