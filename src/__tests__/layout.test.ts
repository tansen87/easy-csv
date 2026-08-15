import { describe, it, expect } from "vitest";
import { Position } from "reactflow";
import {
  resolveHandles,
  handleAnchor,
  getEdgeEndpoints,
  pickStartHandle,
  buildConnectPreviewPath,
  transformBezierPath,
  sideToPosition,
  oppositePosition,
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

describe("sideToPosition", () => {
  it("maps handle names to React Flow positions", () => {
    expect(sideToPosition("left-source")).toBe(Position.Left);
    expect(sideToPosition("table-right-target")).toBe(Position.Right);
    expect(sideToPosition("top-source")).toBe(Position.Top);
    expect(sideToPosition("bottom-target")).toBe(Position.Bottom);
  });
});

describe("oppositePosition", () => {
  it("returns the mirrored side", () => {
    expect(oppositePosition(Position.Left)).toBe(Position.Right);
    expect(oppositePosition(Position.Right)).toBe(Position.Left);
    expect(oppositePosition(Position.Top)).toBe(Position.Bottom);
    expect(oppositePosition(Position.Bottom)).toBe(Position.Top);
  });
});

describe("pickStartHandle", () => {
  const rect = { x: 0, y: 0, width: 220, height: 90 };

  it("defaults to right-source while the cursor is inside the node", () => {
    expect(pickStartHandle("a", rect, { x: 110, y: 45 })).toBe("right-source");
  });

  it("picks bottom-source when the cursor is below the node", () => {
    expect(pickStartHandle("a", rect, { x: 110, y: 300 })).toBe(
      "bottom-source",
    );
  });

  it("picks top-source when the cursor is above the node", () => {
    expect(pickStartHandle("a", rect, { x: 110, y: -100 })).toBe("top-source");
  });

  it("picks right-source when the cursor is to the right", () => {
    expect(pickStartHandle("a", rect, { x: 400, y: 45 })).toBe("right-source");
  });

  it("picks left-source when the cursor is to the left", () => {
    expect(pickStartHandle("a", rect, { x: -300, y: 45 })).toBe("left-source");
  });

  it("keeps the table- prefix for the table node", () => {
    expect(pickStartHandle("table-node", rect, { x: 110, y: 300 })).toBe(
      "table-bottom-source",
    );
  });
});

describe("buildConnectPreviewPath", () => {
  const sourceRect = { x: 0, y: 0, width: 220, height: 90 };

  it("builds a bezier from the source anchor to a free cursor", () => {
    const { d, sourceAnchor, targetAnchor } = buildConnectPreviewPath({
      sourceId: "a",
      sourceRect,
      sourceHandle: "right-source",
      cursor: { x: 500, y: 45 },
    });
    expect(d).toMatch(/^M[\d.]+,[\d.]+ C[\d.]+,[\d.]+ [\d.]+,[\d.]+ [\d.]+,[\d.]+$/);
    expect(sourceAnchor).toEqual({ x: 220, y: 45 });
    expect(targetAnchor).toEqual({ x: 500, y: 45 });
  });

  it("snaps to the target node anchors when hovering a target", () => {
    const targetRect = { x: 0, y: 300, width: 220, height: 90 };
    const { d, sourceAnchor, targetAnchor } = buildConnectPreviewPath({
      sourceId: "a",
      sourceRect,
      sourceHandle: "right-source",
      cursor: { x: 500, y: 400 },
      target: { id: "b", rect: targetRect },
    });
    // 垂直排布 → 底部→顶部,锚点吸附到真实边上
    expect(sourceAnchor).toEqual({ x: 110, y: 90 });
    expect(targetAnchor).toEqual({ x: 110, y: 300 });
    expect(d).toMatch(/^M[\d.]+,[\d.]+ C/);
  });

  it("resolves handles from the target node, ignoring the initial sourceHandle", () => {
    const targetRect = { x: 300, y: 0, width: 220, height: 90 };
    const { sourceAnchor, targetAnchor } = buildConnectPreviewPath({
      sourceId: "a",
      sourceRect,
      sourceHandle: "top-source",
      cursor: { x: 500, y: 45 },
      target: { id: "b", rect: targetRect },
    });
    expect(sourceAnchor).toEqual({ x: 220, y: 45 });
    expect(targetAnchor).toEqual({ x: 300, y: 45 });
  });
});

describe("transformBezierPath", () => {
  it("maps every bezier point through the affine transform", () => {
    const d = "M0,0 C10,0 20,0 30,0";
    const out = transformBezierPath(d, (p) => ({
      x: p.x + 100,
      y: p.y * 2,
    }));
    expect(out).toBe("M100,0 C110,0 120,0 130,0");
  });

  it("returns the input unchanged for unexpected formats", () => {
    const d = "M0,0 L1,1";
    expect(transformBezierPath(d, (p) => p)).toBe(d);
  });
});
