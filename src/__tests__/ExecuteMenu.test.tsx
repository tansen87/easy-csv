import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { MainMenu } from "@/components/menu/MainMenu";
import type { RunSession } from "@/types/execution";

/**
 * Execute menu (design 028 §5.6 / §9.2 T9 + T10).
 *
 * The toolbar "执行" button is a per-tab menu: the current tab is pinned on top,
 * a thin divider separates the others, clicking a row runs that tab, and a
 * running row keeps only "取消". The button itself must stay structurally
 * identical in both states (no icon is added while running).
 */

function makeRun(tabId: string, patch: Partial<RunSession>): RunSession {
  return {
    runId: `run-${tabId}`,
    tabId,
    state: "running",
    branch: null,
    showProgress: true,
    startedAt: 0,
    snapshot: {
      executableSteps: [],
      outputPath: "",
      edges: [],
      currentPipeline: [],
      currentTab: { id: tabId, name: tabId } as never,
      inputFile: "",
      delimiter: ",",
    },
    ...patch,
  };
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    activeMenu: null,
    setActiveMenu: vi.fn(),
    isMenuActivated: false,
    setIsMenuActivated: vi.fn(),
    undoStack: [],
    redoStack: [],
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    tabs: [
      { id: "a", name: "A 销售数据" },
      { id: "b", name: "B 库存" },
      { id: "c", name: "C 客户" },
    ],
    runs: {} as Record<string, RunSession>,
    currentTabId: "a",
    onSelectTab: vi.fn(),
    onRunTab: vi.fn(),
    onCancelTab: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenNewTabWithFile: vi.fn(),
    onSavePipeline: vi.fn(),
    onImportPipeline: vi.fn(),
    onExportPipeline: vi.fn(),
    onUseOrSaveTemplate: vi.fn(),
    onHelp: vi.fn(),
    onCheckUpdate: vi.fn(),
    onShowSettings: vi.fn(),
    onOpenPalette: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenCsvDiff: vi.fn(),
    onOpenCsvEncoding: vi.fn(),
    onOpenSeparateCsv: vi.fn(),
    onOpenSplitLines: vi.fn(),
    onOpenMergeExcel: vi.fn(),
    isExecuting: false,
    isCheckingUpdate: false,
    hasUpdate: false,
    showLogErrorBadge: false,
    currentPipelineLength: 2,
    showCommandPanel: false,
    onToggleCommandPanel: vi.fn(),
    showLogPanel: false,
    onToggleLogPanel: vi.fn(),
    showDataProfile: false,
    onToggleDataProfile: vi.fn(),
    hasInputFile: true,
    showVersionPanel: false,
    onToggleVersionPanel: vi.fn(),
    showLineagePanel: false,
    onToggleLineagePanel: vi.fn(),
    showAIPanel: false,
    onToggleAIPanel: vi.fn(),
    showVariablePanel: false,
    onToggleVariablePanel: vi.fn(),
    ...overrides,
  };
}

function renderMenu(overrides: Record<string, unknown> = {}) {
  const props = baseProps(overrides);
  const utils = render(
    <LanguageProvider>
      <MainMenu {...(props as ComponentProps<typeof MainMenu>)} />
    </LanguageProvider>,
  );
  // The execute button is the only menu trigger carrying `data-busy`.
  const button = utils.container.querySelector(
    '[aria-haspopup="menu"][data-busy]',
  ) as HTMLButtonElement;
  return { ...utils, props, button };
}

const rows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[role="menuitem"]'));

describe("execute menu (design 028 §5.6)", () => {
  it("keeps the button structurally identical while a run is in flight (T10)", () => {
    const idle = renderMenu({ isExecuting: false });
    const idleHtml = idle.button.innerHTML;
    const idleBusy = idle.button.getAttribute("data-busy");
    const idleChildCount = idle.button.children.length;
    idle.unmount();

    const busy = renderMenu({
      isExecuting: true,
      runs: { a: makeRun("a", {}) },
    });

    // No icon node is added and the label is untouched — only `data-busy`
    // flips, which drives the 2px pseudo-element underline.
    expect(busy.button.children.length).toBe(idleChildCount);
    expect(busy.button.children.length).toBe(0);
    expect(busy.button.innerHTML).toBe(idleHtml);
    expect(idleBusy).toBe("false");
    expect(busy.button.getAttribute("data-busy")).toBe("true");
  });

  it("pins the current tab first and separates the rest with a divider (T9)", () => {
    const { container, button } = renderMenu();
    fireEvent.click(button);

    const menu = container.querySelector('[role="menu"]')!;
    expect(menu).toBeTruthy();

    const order = rows(container).map((row) =>
      row.getAttribute("data-tab-id"),
    );
    expect(order).toEqual(["a", "b", "c"]);

    // The divider must sit immediately after the current tab's row.
    const children = Array.from(menu.children);
    const firstRowIndex = children.findIndex(
      (child) => child.getAttribute("data-tab-id") === "a",
    );
    expect(children[firstRowIndex + 1].getAttribute("role")).not.toBe(
      "menuitem",
    );
    expect(children[firstRowIndex + 1].className).toContain("bg-border");
  });

  it("re-pins the menu when the current tab changes", () => {
    const { container, button } = renderMenu({ currentTabId: "b" });
    fireEvent.click(button);
    expect(
      rows(container).map((row) => row.getAttribute("data-tab-id")),
    ).toEqual(["b", "a", "c"]);
  });

  it("shows only progress + cancel on a running row, and switching on click (T4)", () => {
    const { container, button, props } = renderMenu({
      runs: {
        a: makeRun("a", {
          branch: { current: 2, total: 3, name: "汇总", status: "executing" },
        }),
      },
    });
    fireEvent.click(button);

    const rowA = container.querySelector('[data-tab-id="a"]')!;
    expect(rowA.getAttribute("data-state")).toBe("running");
    expect(rowA.textContent).toContain("2/3");

    // The only control inside a running row is the cancel button.
    const buttons = rowA.querySelectorAll("button");
    expect(buttons.length).toBe(1);

    fireEvent.click(buttons[0]);
    expect(props.onCancelTab).toHaveBeenCalledWith("a");
    // Cancelling must not also fire a run.
    expect(props.onRunTab).not.toHaveBeenCalled();

    fireEvent.click(rowA);
    expect(props.onSelectTab).toHaveBeenCalledWith("a");
    expect(props.onRunTab).not.toHaveBeenCalled();
  });

  it("runs that tab when an idle row is clicked, carrying no extra button (T9)", () => {
    const { container, button, props } = renderMenu();
    fireEvent.click(button);

    const rowB = container.querySelector('[data-tab-id="b"]')!;
    expect(rowB.getAttribute("data-state")).toBe("idle");
    expect(rowB.querySelectorAll("button").length).toBe(0);

    fireEvent.click(rowB);
    expect(props.onRunTab).toHaveBeenCalledWith("b");
    // Menu closes after choosing.
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("marks a tab waiting on a dialog instead of offering a run (T9)", () => {
    const { container, button } = renderMenu({
      runs: { a: makeRun("a", { state: "preparing" }) },
    });
    fireEvent.click(button);

    const rowA = container.querySelector('[data-tab-id="a"]')!;
    expect(rowA.getAttribute("data-state")).toBe("preparing");
    expect(rowA.querySelectorAll("button").length).toBe(0);
  });

  it("shows a queued row with only cancel, and only switches on click (design 028 §7.1)", () => {
    const { container, button, props } = renderMenu({
      runs: { a: makeRun("a", { state: "queued" }) },
    });
    fireEvent.click(button);

    const rowA = container.querySelector('[data-tab-id="a"]')!;
    expect(rowA.getAttribute("data-state")).toBe("queued");
    expect(rowA.querySelectorAll("button").length).toBe(1);

    fireEvent.click(rowA);
    expect(props.onSelectTab).toHaveBeenCalledWith("a");
    expect(props.onRunTab).not.toHaveBeenCalled();
  });

  it("opens on hover while another menu-bar menu is open (design 028 §5.6)", () => {
    const { container, button, props } = renderMenu({ activeMenu: "file" });
    expect(container.querySelector('[role="menu"]')).toBeNull();

    fireEvent.mouseEnter(button);

    expect(container.querySelector('[role="menu"]')).toBeTruthy();
    // The sibling menu is disarmed so only one menu is ever open.
    expect(props.setActiveMenu).toHaveBeenCalledWith(null);
  });
});