import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LanguageProvider } from "@/i18n";
import { ViewDock } from "@/modules/pipeline/ViewDock";
import { useViewDock } from "@/hooks/useViewDock";
import {
  DOCK_RAIL_WIDTH,
  DOCK_WIDTH_DEFAULT,
  VIEW_PANELS,
  clampDockWidth,
} from "@/modules/pipeline/viewPanels";

/**
 * Design 076 · option A. The dock holds exactly one panel: opening a second one
 * replaces the first instead of covering it, and the rail is the switch that
 * makes the replacement visible rather than silent.
 */
function Harness() {
  const dock = useViewDock();
  return (
    <LanguageProvider>
      <span data-testid="dock-width">{dock.dockWidth}</span>
      <span data-testid="active-panel">{dock.activePanel ?? "none"}</span>
      <button type="button" onClick={() => dock.togglePanel("profile")}>
        toggle-profile
      </button>
      <button type="button" onClick={() => dock.togglePanel("variables")}>
        toggle-variables
      </button>
      <ViewDock
        activePanel={dock.activePanel}
        onSelectPanel={dock.togglePanel}
        width={dock.panelWidth}
        onWidthChange={dock.setWidth}
      >
        <span data-testid="panel-body">{dock.activePanel}</span>
      </ViewDock>
    </LanguageProvider>
  );
}

const renderHarness = () => render(<Harness />);

/** The four rail switches, in menu order. */
const railButtons = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.hasAttribute("aria-pressed"));

describe("useViewDock (design 076)", () => {
  it("keeps no dock at all until a panel is chosen", () => {
    renderHarness();
    expect(screen.queryByTestId("view-dock")).toBeNull();
    expect(screen.getByTestId("dock-width")).toHaveTextContent("0");
  });

  it("reserves exactly the panel width plus the rail", () => {
    renderHarness();
    fireEvent.click(screen.getByText("toggle-profile"));
    expect(screen.getByTestId("dock-width")).toHaveTextContent(
      String(DOCK_WIDTH_DEFAULT + DOCK_RAIL_WIDTH),
    );
  });

  it("replaces the open panel instead of stacking a second one", () => {
    renderHarness();
    fireEvent.click(screen.getByText("toggle-profile"));
    fireEvent.click(screen.getByText("toggle-variables"));

    expect(screen.getAllByTestId("view-dock")).toHaveLength(1);
    expect(screen.getByTestId("view-dock")).toHaveAttribute(
      "data-active-panel",
      "variables",
    );
    expect(screen.getAllByTestId("panel-body")).toHaveLength(1);
  });

  it("closes when the panel that is already open is chosen again", () => {
    renderHarness();
    fireEvent.click(screen.getByText("toggle-profile"));
    fireEvent.click(screen.getByText("toggle-profile"));
    expect(screen.queryByTestId("view-dock")).toBeNull();
    expect(screen.getByTestId("dock-width")).toHaveTextContent("0");
  });

  it("switches panels from the rail and marks the current one pressed", () => {
    renderHarness();
    fireEvent.click(screen.getByText("toggle-profile"));

    expect(railButtons()).toHaveLength(VIEW_PANELS.length);
    expect(railButtons()[0]).toHaveAttribute("aria-pressed", "true");
    expect(railButtons()[1]).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(railButtons()[1]);
    expect(screen.getByTestId("active-panel")).toHaveTextContent("version");
    expect(railButtons()[1]).toHaveAttribute("aria-pressed", "true");
    expect(railButtons()[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("binds Alt+1..4 to the panels", () => {
    renderHarness();

    fireEvent.keyDown(window, { key: "3", altKey: true });
    expect(screen.getByTestId("active-panel")).toHaveTextContent("lineage");

    fireEvent.keyDown(window, { key: "3", altKey: true });
    expect(screen.getByTestId("active-panel")).toHaveTextContent("none");

    fireEvent.keyDown(window, { key: "1", altKey: true });
    fireEvent.keyDown(window, { key: "1", altKey: true });
    expect(screen.queryByTestId("view-dock")).toBeNull();
  });

  it("clamps the draggable width to the documented range", () => {
    expect(clampDockWidth(120)).toBe(280);
    expect(clampDockWidth(360)).toBe(360);
    expect(clampDockWidth(999)).toBe(420);
  });
});
