import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { useCanvasKeyboardPan } from "@/components/panel/hooks/useCanvasKeyboardPan";

type Viewport = { x: number; y: number; zoom: number };

function Harness({ instanceRef }: { instanceRef: MutableRefObject<any> }) {
  useCanvasKeyboardPan(instanceRef, true);
  return null;
}

function makeInstance() {
  let vp: Viewport = { x: 0, y: 0, zoom: 1 };
  const getViewport = vi.fn(() => vp);
  const setViewport = vi.fn((next: Viewport) => {
    vp = next;
  });
  const instanceRef = { current: { getViewport, setViewport } };
  return { instanceRef, setViewport, viewport: () => vp };
}

function key(
  type: "keydown" | "keyup",
  keyName: string,
  init: KeyboardEventInit = {},
) {
  window.dispatchEvent(
    new KeyboardEvent(type, { key: keyName, bubbles: true, ...init }),
  );
}

describe("useCanvasKeyboardPan", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
        "Date",
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pans the viewport continuously while a key is held", () => {
    const { instanceRef, setViewport, viewport } = makeInstance();
    render(<Harness instanceRef={instanceRef} />);

    key("keydown", "w");
    vi.advanceTimersByTime(1000);

    expect(setViewport).toHaveBeenCalled();
    expect(viewport().x).toBe(0);
    // W = upward view: viewport.y increases (~600px/s)
    expect(viewport().y).toBeGreaterThan(400);
    expect(viewport().y).toBeLessThan(800);
    key("keyup", "w");
  });

  it("maps arrow keys and A/S/D to the correct axes", () => {
    const { instanceRef, viewport } = makeInstance();
    render(<Harness instanceRef={instanceRef} />);

    key("keydown", "a"); // [1,0] -> x increases
    vi.advanceTimersByTime(1000);
    expect(viewport().x).toBeGreaterThan(400);
    expect(viewport().y).toBe(0);
    key("keyup", "a");
  });

  it("normalizes diagonal input so combined speed is not faster than a single key", () => {
    const { instanceRef, viewport } = makeInstance();
    render(<Harness instanceRef={instanceRef} />);

    key("keydown", "w"); // [0,1]
    key("keydown", "d"); // [-1,0]
    vi.advanceTimersByTime(1000);

    // Diagonal: |dx| == |dy|, each ~ 600/√2 px/s
    const dx = Math.abs(viewport().x);
    const dy = viewport().y;
    expect(dy).toBeGreaterThan(400); // 600/√2 ≈ 424 over 1s
    expect(dx).toBeGreaterThan(400);
    expect(dx).toBeCloseTo(dy, 0);
    key("keyup", "w");
    key("keyup", "d");
  });

  it("boosts speed when Shift is held", () => {
    const { instanceRef, viewport } = makeInstance();
    render(<Harness instanceRef={instanceRef} />);

    key("keydown", "Shift");
    key("keydown", "w");
    vi.advanceTimersByTime(1000);
    key("keyup", "w");
    key("keyup", "Shift");

    // ~2x of BASE_SPEED
    expect(viewport().y).toBeGreaterThan(900);
    expect(viewport().y).toBeLessThan(1600);
  });

  it("does not pan when the keydown target is an input", () => {
    const { instanceRef, setViewport } = makeInstance();
    render(<Harness instanceRef={instanceRef} />);

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "w", bubbles: true }),
    );
    vi.advanceTimersByTime(1000);

    expect(setViewport).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("yields to global shortcuts that use Ctrl/Alt/Meta", () => {
    const { instanceRef, setViewport } = makeInstance();
    render(<Harness instanceRef={instanceRef} />);

    key("keydown", "d", { ctrlKey: true });
    vi.advanceTimersByTime(1000);
    expect(setViewport).not.toHaveBeenCalled();
  });

  it("stops moving once all keys are released", () => {
    const { instanceRef, setViewport, viewport } = makeInstance();
    render(<Harness instanceRef={instanceRef} />);

    key("keydown", "w");
    vi.advanceTimersByTime(200);
    key("keyup", "w");
    const callsAfterRelease = setViewport.mock.calls.length;
    const yAfterRelease = viewport().y;

    vi.advanceTimersByTime(1000);
    expect(viewport().y).toBe(yAfterRelease);
    expect(setViewport.mock.calls.length).toBe(callsAfterRelease);
  });

  it("clears pressed keys on window blur so the view does not keep drifting", () => {
    const { instanceRef, setViewport, viewport } = makeInstance();
    render(<Harness instanceRef={instanceRef} />);

    key("keydown", "w");
    vi.advanceTimersByTime(200);
    window.dispatchEvent(new Event("blur"));
    const callsAfterBlur = setViewport.mock.calls.length;
    const yAfterBlur = viewport().y;

    vi.advanceTimersByTime(1000);
    expect(viewport().y).toBe(yAfterBlur);
    expect(setViewport.mock.calls.length).toBe(callsAfterBlur);
  });
});
