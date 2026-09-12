import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import type { RefObject } from "react";
import { useCanvasKeyboardPan } from "@/components/panel/hooks/useCanvasKeyboardPan";
import { useCanvasPointerHud } from "@/components/panel/hooks/useCanvasPointerHud";
import { KeyIndicatorOverlay } from "@/components/panel/overlays/KeyIndicatorOverlay";

type Viewport = { x: number; y: number; zoom: number };

function Harness({ instanceRef }: { instanceRef: RefObject<any> }) {
  useCanvasKeyboardPan(instanceRef, true);
  return null;
}

function CallbacksHarness({
  instanceRef,
  onChange,
}: {
  instanceRef: RefObject<any>;
  onChange: (keys: string[], shift: boolean) => void;
}) {
  useCanvasKeyboardPan(instanceRef, true, onChange);
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

  describe("onChangeKeys callback", () => {
    it("notifies keys added/removed without re-emitting repeats", () => {
      const { instanceRef } = makeInstance();
      const onChange = vi.fn();
      render(
        <CallbacksHarness instanceRef={instanceRef} onChange={onChange} />,
      );

      key("keydown", "w");
      expect(onChange).toHaveBeenLastCalledWith(["w"], false);
      key("keydown", "d");
      expect(onChange).toHaveBeenLastCalledWith(["w", "d"], false);
      // System key-repeat does not re-notify (guarded by !pressed.has(k))
      const before = onChange.mock.calls.length;
      key("keydown", "w");
      expect(onChange.mock.calls.length).toBe(before);

      key("keyup", "w");
      expect(onChange).toHaveBeenLastCalledWith(["d"], false);
      key("keyup", "d");
      expect(onChange).toHaveBeenLastCalledWith([], false);
    });

    it("reports Shift state through the callback", () => {
      const { instanceRef } = makeInstance();
      const onChange = vi.fn();
      render(
        <CallbacksHarness instanceRef={instanceRef} onChange={onChange} />,
      );

      key("keydown", "Shift");
      expect(onChange).toHaveBeenLastCalledWith([], true);
      key("keyup", "Shift");
      expect(onChange).toHaveBeenLastCalledWith([], false);
    });

    it("clears keys and Shift on window blur", () => {
      const { instanceRef } = makeInstance();
      const onChange = vi.fn();
      render(
        <CallbacksHarness instanceRef={instanceRef} onChange={onChange} />,
      );

      key("keydown", "Shift");
      key("keydown", "w");
      window.dispatchEvent(new Event("blur"));
      expect(onChange).toHaveBeenLastCalledWith([], false);
    });
  });

  describe("useCanvasPointerHud", () => {
    function renderPointer(onChange: (b: number[], s: boolean) => void) {
      const ref = { current: document.createElement("div") };
      function Inner() {
        useCanvasPointerHud(ref as RefObject<HTMLElement>, onChange);
        return null;
      }
      render(<Inner />);
      return ref.current as HTMLDivElement;
    }

    it("tracks left/right buttons in fixed order and clears with mouseup/blur", () => {
      const onChange = vi.fn();
      const container = renderPointer(onChange);

      fireEvent.mouseDown(container, { button: 2 });
      expect(onChange).toHaveBeenLastCalledWith([2], false);
      fireEvent.mouseDown(container, { button: 0 });
      expect(onChange).toHaveBeenLastCalledWith([0, 2], false); // order fixed, not press order

      // mouseup cannot be trusted for e.button; the set is rebuilt from e.buttons (1=left held)
      fireEvent.mouseUp(container, { button: 2, buttons: 1 });
      expect(onChange).toHaveBeenLastCalledWith([0], false);
      fireEvent.mouseUp(container, { buttons: 0 });
      expect(onChange).toHaveBeenLastCalledWith([], false);

      window.dispatchEvent(new Event("blur"));
      expect(onChange).toHaveBeenLastCalledWith([], false);
    });

    it("ignores the middle button entirely", () => {
      const onChange = vi.fn();
      const container = renderPointer(onChange);

      fireEvent.mouseDown(container, { button: 1 });
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.mouseUp(container, { buttons: 0 });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clears buttons on mouseleave only when no buttons are held", () => {
      const onChange = vi.fn();
      const container = renderPointer(onChange);

      fireEvent.mouseDown(container, { button: 2 });
      fireEvent.mouseLeave(container, { buttons: 2 }); // still held → keep
      expect(onChange).not.toHaveBeenLastCalledWith([], expect.anything());
      fireEvent.mouseLeave(container, { buttons: 0 }); // released → clear
      expect(onChange).toHaveBeenLastCalledWith([], false);
    });

    it("tracks Space and ignores it inside inputs", () => {
      const onChange = vi.fn();
      renderPointer(onChange);

      key("keydown", " ");
      expect(onChange).toHaveBeenLastCalledWith([], true);
      key("keyup", " ");
      expect(onChange).toHaveBeenLastCalledWith([], false);

      // Inside an input the guard short-circuits, so no new callbacks fire.
      const before = onChange.mock.calls.length;
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
      input.dispatchEvent(
        new KeyboardEvent("keyup", { key: " ", bubbles: true }),
      );
      expect(onChange.mock.calls.length).toBe(before);
      document.body.removeChild(input);
    });
  });

  describe("KeyIndicatorOverlay", () => {
    const labels = { left: "左键", middle: "中键", right: "右键" };

    it("renders keycaps in fixed W/A/S/D then arrow order", () => {
      render(
        <KeyIndicatorOverlay
          keys={["d", "w"]}
          shift={false}
          buttons={[]}
          space={false}
          labels={labels}
        />,
      );
      const kbd = screen.getAllByText(/W|D/);
      expect(kbd[0].textContent).toBe("W");
      expect(kbd[1].textContent).toBe("D");
    });

    it("maps arrow keys to their unicode glyphs", () => {
      render(
        <KeyIndicatorOverlay
          keys={["arrowup"]}
          shift={false}
          buttons={[]}
          space={false}
          labels={labels}
        />,
      );
      expect(screen.getByText("↑")).toBeTruthy();
    });

    it("shows Space keycap and mouse capsule for Space+LMB panning", () => {
      render(
        <KeyIndicatorOverlay
          keys={[]}
          shift={false}
          buttons={[0]}
          space={true}
          labels={labels}
        />,
      );
      expect(screen.getByText("左键")).toBeTruthy();
      expect(screen.getByText("Space")).toBeTruthy();
    });

    it("shows the left-button capsule alone", () => {
      render(
        <KeyIndicatorOverlay
          keys={[]}
          shift={false}
          buttons={[0]}
          space={false}
          labels={labels}
        />,
      );
      expect(screen.getByText("左键")).toBeTruthy();
    });

    it("shows the ×2 badge when Shift is held", () => {
      render(
        <KeyIndicatorOverlay
          keys={["w"]}
          shift={true}
          buttons={[]}
          space={false}
          labels={labels}
        />,
      );
      expect(screen.getByText("×2")).toBeTruthy();
    });

    it("hides (mounts nothing) once keys, buttons and Space are all idle", () => {
      const { container, rerender } = render(
        <KeyIndicatorOverlay
          keys={["w"]}
          shift={false}
          buttons={[]}
          space={false}
          labels={labels}
        />,
      );
      expect(container.querySelector("kbd")).toBeTruthy();

      rerender(
        <KeyIndicatorOverlay
          keys={[]}
          shift={false}
          buttons={[]}
          space={false}
          labels={labels}
        />,
      );
      // Holds fully visible for HOLD_MS, fades, then unmounts after HOLD+FADE.
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(container.querySelector("kbd")).toBeNull();
    });
  });
});
