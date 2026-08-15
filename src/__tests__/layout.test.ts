import { describe, it, expect } from "vitest";
import {
  resolveHandles,
  handleAnchor,
  getEdgeEndpoints,
} from "@/components/panel/utils/layout";

function node(_id: string, x: number, y: number, width = 220, height = 90) {
  return { position: { x, y }, width, height };
}

describe("resolveHandles", () => {
  it("connects right→left when target is horizontally to the right", () => {
    const { sourceHandle, targetHandle } = resolveHandles(
      "a",
      "b",
      node("a", 0, 0),
      node("b", 300, 0),
    );
    expect(sourceHandle).toBe("right-source");
    expect(targetHandle).toBe("left-target");
  });

  it("connects left→right when target is horizontally to the left", () => {
    const { sourceHandle, targetHandle } = resolveHandles(
      "a",
      "b",
      node("a", 300, 0),
      node("b", 0, 0),
    );
    expect(sourceHandle).toBe("left-source");
    expect(targetHandle).toBe("right-target");
  });

  it("connects bottom→top when target is vertically below", () => {
    const { sourceHandle, targetHandle } = resolveHandles(
      "a",
      "b",
      node("a", 0, 0),
      node("b", 0, 300),
    );
    expect(sourceHandle).toBe("bottom-source");
    expect(targetHandle).toBe("top-target");
  });

  it("connects top→bottom when target is vertically above", () => {
    const { sourceHandle, targetHandle } = resolveHandles(
      "a",
      "b",
      node("a", 0, 300),
      node("b", 0, 0),
    );
    expect(sourceHandle).toBe("top-source");
    expect(targetHandle).toBe("bottom-target");
  });

  it("prefers vertical connection on a diagonal layout", () => {
    const { sourceHandle, targetHandle } = resolveHandles(
      "a",
      "b",
      node("a", 0, 0),
      node("b", 100, 300),
    );
    expect(sourceHandle).toBe("bottom-source");
    expect(targetHandle).toBe("top-target");
  });

  it("uses table- prefix for the table-node", () => {
    const { sourceHandle, targetHandle } = resolveHandles(
      "table-node",
      "b",
      node("table-node", 0, 0),
      node("b", 300, 0),
    );
    expect(sourceHandle).toBe("table-right-source");
    expect(targetHandle).toBe("left-target");

    const vertical = resolveHandles(
      "a",
      "table-node",
      node("a", 0, 0),
      node("table-node", 0, 300),
    );
    expect(vertical.sourceHandle).toBe("bottom-source");
    expect(vertical.targetHandle).toBe("table-top-target");
  });

  it("accounts for node centers when sizes differ", () => {
    // 源节点很宽(500):左上角在目标左侧,但中心已落在目标右侧 → 走 left→right
    const wide = node("a", 0, 0, 500, 100);
    const { sourceHandle, targetHandle } = resolveHandles(
      "a",
      "b",
      wide,
      node("b", 150, 0, 40, 90),
    );
    expect(sourceHandle).toBe("left-source");
    expect(targetHandle).toBe("right-target");
  });

  it("falls back to right→left when positions are unknown", () => {
    const { sourceHandle, targetHandle } = resolveHandles("a", "b");
    expect(sourceHandle).toBe("right-source");
    expect(targetHandle).toBe("left-target");
  });
});

describe("handleAnchor", () => {
  const rect = { x: 100, y: 200, width: 200, height: 100 };

  it("returns the left edge midpoint for left handles", () => {
    expect(handleAnchor(rect, "left-source")).toEqual({ x: 100, y: 250 });
  });

  it("returns the right edge midpoint for right handles", () => {
    expect(handleAnchor(rect, "right-target")).toEqual({ x: 300, y: 250 });
  });

  it("returns the top edge midpoint for top handles", () => {
    expect(handleAnchor(rect, "top-source")).toEqual({ x: 200, y: 200 });
  });

  it("returns the bottom edge midpoint for bottom handles", () => {
    expect(handleAnchor(rect, "bottom-target")).toEqual({ x: 200, y: 300 });
  });
});

describe("getEdgeEndpoints", () => {
  it("uses vertical endpoints for a vertical edge", () => {
    const source = { x: 0, y: 0, width: 220, height: 90 };
    const target = { x: 0, y: 300, width: 220, height: 90 };
    const { start, end } = getEdgeEndpoints("a", "b", source, target);
    expect(start).toEqual({ x: 110, y: 90 });
    expect(end).toEqual({ x: 110, y: 300 });
  });

  it("uses horizontal endpoints for a horizontal edge", () => {
    const source = { x: 0, y: 0, width: 220, height: 90 };
    const target = { x: 300, y: 0, width: 220, height: 90 };
    const { start, end } = getEdgeEndpoints("a", "b", source, target);
    expect(start).toEqual({ x: 220, y: 45 });
    expect(end).toEqual({ x: 300, y: 45 });
  });
});
