import { describe, it, expect } from "vitest";
import { clampPanelPosition } from "@/utils/panelDock";
import { PanelDockState } from "@/types/xan";

const viewportWidth = 1024;
const viewportHeight = 640;

describe("panelDock", () => {
  describe("clampPanelPosition", () => {
    it("uses defaults when no dock state is present", () => {
      const pos = clampPanelPosition(undefined, {
        width: 600,
        height: 300,
        viewportWidth,
        viewportHeight,
      });
      expect(pos.x).toBe(1024 - 600);
      expect(pos.y).toBe((640 - 300) / 2);
    });

    it("clamps x to the right edge when the panel is wider than the viewport", () => {
      const pos = clampPanelPosition(
        { x: 1000, y: 100 },
        {
          width: 900,
          height: 300,
          viewportWidth,
          viewportHeight,
        },
      );
      expect(pos.x).toBe(1024 - 900);
    });

    it("keeps persisted positions inside bounds", () => {
      const pos = clampPanelPosition(
        { x: 50, y: 120 },
        {
          width: 300,
          height: 400,
          viewportWidth,
          viewportHeight,
        },
      );
      expect(pos.x).toBe(50);
      expect(pos.y).toBe(120);
    });

    it("pushes out-of-bounds positions back inside", () => {
      const pos = clampPanelPosition(
        { x: -20, y: 1000 },
        {
          width: 300,
          height: 400,
          viewportWidth,
          viewportHeight,
        },
      );
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(640 - 400);
    });

    it("respects the minimum y (app header)", () => {
      const pos = clampPanelPosition(
        { x: 10, y: 0 },
        {
          width: 300,
          height: 400,
          minY: 56,
          viewportWidth,
          viewportHeight,
        },
      );
      expect(pos.y).toBe(56);
    });

    it("falls back to defaults when only one axis is persisted", () => {
      const dock: PanelDockState = { x: 40 };
      const pos = clampPanelPosition(dock, {
        width: 300,
        height: 400,
        viewportWidth,
        viewportHeight,
      });
      expect(pos.x).toBe(40);
      expect(pos.y).toBe((640 - 400) / 2);
    });

    it("docks to the right edge by default", () => {
      const pos = clampPanelPosition(undefined, {
        width: 520,
        height: 400,
        viewportWidth,
        viewportHeight,
      });
      expect(pos.x).toBe(viewportWidth - 520);
    });

    it("docks left with a gap when asked (design 072)", () => {
      // The command panel passes 54 so it clears the canvas tool rail (12–46).
      const pos = clampPanelPosition(undefined, {
        width: 380,
        height: 540,
        viewportWidth,
        viewportHeight,
        side: "left",
        offset: 54,
      });
      expect(pos.x).toBe(54);
      // Centring would be 50, but the app header (56) wins.
      expect(pos.y).toBe(56);
    });

    it("still honours a saved position when docked left", () => {
      const pos = clampPanelPosition(
        { x: 300, y: 80 },
        {
          width: 380,
          height: 540,
          viewportWidth,
          viewportHeight,
          side: "left",
          offset: 54,
        },
      );
      expect(pos.x).toBe(300);
      expect(pos.y).toBe(80);
    });
  });
});
