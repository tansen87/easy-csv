import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { translations } from "@/i18n/translations";
import { MainMenu } from "@/components/menu/MainMenu";
import type { RunSession } from "@/types/execution";

/** jsdom reports en-US, so the provider resolves to English here. */
const copy = translations.en;

/**
 * Run panel.
 *
 * "执行" stays a menu-bar item (click opens, hover switches only while another
 * menu is open). Its panel groups tabs by run state — running / queued /
 * preparing / idle — with the current tab first inside its group. Clicking an
 * idle row runs that tab (a run already in flight only switches); running,
 * stopping and reviewing also live in the trailing button. The trigger itself
 * must stay structurally identical while busy.
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
    onLoadDemo: vi.fn(),
    onHelp: vi.fn(),
    onReportIssue: vi.fn(),
    onCheckUpdate: vi.fn(),
    onShowAbout: vi.fn(),
    onShowSettings: vi.fn(),
    onOpenPalette: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenCsvDiff: vi.fn(),
    onOpenCsvEncoding: vi.fn(),
    onOpenSeparateCsv: vi.fn(),
    onOpenSplitLines: vi.fn(),
    onOpenEnumerateByGroup: vi.fn(),
    onOpenCsvToExcel: vi.fn(),
    onOpenMergeExcel: vi.fn(),
    isExecuting: false,
    isCheckingUpdate: false,
    hasUpdate: false,
    showLogErrorBadge: false,
    currentPipelineLength: 2,
    maxConcurrentRuns: 4,
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
    showSettingsDialog: false,
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

/**
 * The run panel is portalled to `document.body`, outside the render container.
 * Scoped to a direct child of body so it never picks up one of the five
 * menu-bar dropdowns (design 054 gave them `role="menu"` too).
 */
const menuEl = () =>
  document.querySelector<HTMLElement>('body > [role="menu"]');
const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(`[data-tab-id="${id}"]`);

describe("run panel (design 052)", () => {
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

  it("uses the same hover and open states as the other menu-bar items", () => {
    const { button } = renderMenu({
      isExecuting: true,
      runs: { a: makeRun("a", {}) },
    });
    // Busy only adds the 2px line; hover is background-only, like 文件 / 编辑.
    expect(button.className).not.toContain("hover:text-primary");
    expect(button.className).toContain("hover:bg-primary/10");

    fireEvent.click(button);
    // Open state matches the other menus: 12% ink under ink text, no grey.
    expect(button.className).toContain("bg-primary/12");
    expect(button.className).toContain("text-primary");
    expect(button.className).not.toContain("bg-accent");
  });

  it("groups tabs by state and keeps the current tab first inside its group", () => {
    const { button } = renderMenu({
      runs: {
        b: makeRun("b", { state: "running" }),
        c: makeRun("c", { state: "queued" }),
        a: makeRun("a", { state: "queued" }),
      },
    });
    fireEvent.click(button);

    const groups = Array.from(document.querySelectorAll("[data-group]")).map(
      (group) => group.getAttribute("data-group"),
    );
    expect(groups).toEqual(["running", "queued"]);

    const queued = document.querySelector('[data-group="queued"]')!;
    expect(
      Array.from(queued.querySelectorAll('[role="menuitem"]')).map((row) =>
        row.getAttribute("data-tab-id"),
      ),
    ).toEqual(["a", "c"]);
  });

  it("re-orders the idle group when the current tab changes", () => {
    const { button } = renderMenu({ currentTabId: "b" });
    fireEvent.click(button);

    const idle = document.querySelector('[data-group="idle"]')!;
    expect(
      Array.from(idle.querySelectorAll('[role="menuitem"]')).map((row) =>
        row.getAttribute("data-tab-id"),
      ),
    ).toEqual(["b", "a", "c"]);
  });

  it("shows progress + stop on a running row, and only switches when the row is clicked", () => {
    const { button, props } = renderMenu({
      runs: {
        a: makeRun("a", {
          branch: { current: 2, total: 3, name: "汇总", status: "executing" },
        }),
      },
    });
    fireEvent.click(button);

    const rowA = rowEl("a")!;
    expect(rowA.getAttribute("data-state")).toBe("running");
    expect(rowA.textContent).toContain("2/3");

    const actions = rowA.querySelectorAll("button");
    expect(actions.length).toBe(1);
    expect(actions[0].textContent).toBe(copy.runStop);

    fireEvent.click(actions[0]);
    expect(props.onCancelTab).toHaveBeenCalledWith("a");
    expect(props.onRunTab).not.toHaveBeenCalled();
  });

  it("only switches tabs when a running row is clicked", () => {
    const { button, props } = renderMenu({
      runs: { a: makeRun("a", {}) },
    });
    fireEvent.click(button);

    const rowA = rowEl("a")!;
    fireEvent.click(rowA);

    expect(props.onSelectTab).toHaveBeenCalledWith("a");
    expect(props.onRunTab).not.toHaveBeenCalled();
    expect(menuEl()).toBeNull();
  });

  it("runs an idle tab when its row is clicked, and offers the same action in the row", () => {
    const { button, props } = renderMenu();
    fireEvent.click(button);

    const rowB = rowEl("b")!;
    expect(rowB.getAttribute("data-state")).toBe("idle");

    const actions = rowB.querySelectorAll("button");
    expect(actions.length).toBe(1);
    expect(actions[0].textContent).toBe(copy.execute);

    fireEvent.click(rowB);
    expect(props.onRunTab).toHaveBeenCalledWith("b");
    expect(props.onSelectTab).not.toHaveBeenCalled();
    expect(menuEl()).toBeNull();
  });

  it("runs the tab from the row action and closes the panel", () => {
    const { button, props } = renderMenu();
    fireEvent.click(button);

    const rowB = rowEl("b")!;
    fireEvent.click(rowB.querySelector("button")!);

    expect(props.onRunTab).toHaveBeenCalledWith("b");
    expect(menuEl()).toBeNull();
  });

  it("shows a review action for a tab waiting on a dialog", () => {
    const { button, props } = renderMenu({
      runs: { a: makeRun("a", { state: "preparing" }) },
    });
    fireEvent.click(button);

    const rowA = rowEl("a")!;
    expect(rowA.getAttribute("data-state")).toBe("preparing");

    const actions = rowA.querySelectorAll("button");
    expect(actions.length).toBe(1);
    expect(actions[0].textContent).toBe(copy.runHandle);

    fireEvent.click(actions[0]);
    expect(props.onSelectTab).toHaveBeenCalledWith("a");
    expect(props.onRunTab).not.toHaveBeenCalled();
  });

  it("keeps stop on a queued row and only switches on row click", () => {
    const { button, props } = renderMenu({
      runs: { a: makeRun("a", { state: "queued" }) },
    });
    fireEvent.click(button);

    const rowA = rowEl("a")!;
    expect(rowA.getAttribute("data-state")).toBe("queued");
    expect(rowA.querySelector("button")!.textContent).toBe(copy.runStop);

    fireEvent.click(rowA);
    expect(props.onSelectTab).toHaveBeenCalledWith("a");
    expect(props.onRunTab).not.toHaveBeenCalled();
  });

  it("gives a failed tab a run action plus its failed readout", () => {
    const { button, props } = renderMenu({
      runs: { b: makeRun("b", { state: "error" }) },
    });
    fireEvent.click(button);

    const rowB = rowEl("b")!;
    expect(rowB.getAttribute("data-state")).toBe("error");
    expect(rowB.textContent).toContain(copy.runStateFailed);
    expect(rowB.querySelector("button")!.textContent).toBe(copy.execute);

    fireEvent.click(rowB);
    expect(props.onRunTab).toHaveBeenCalledWith("b");
  });

  it("shows the concurrency limit and Ctrl+R in the panel footer", () => {
    const { button } = renderMenu({ maxConcurrentRuns: 6 });
    fireEvent.click(button);

    const menu = menuEl()!;
    expect(menu.textContent).toContain(
      copy.runLimitHint.replace("{count}", "6"),
    );
    expect(menu.querySelectorAll("kbd").length).toBe(1);
    expect(menu.querySelector("kbd")!.textContent).toBe("Ctrl+R");
  });

  it("puts a dot on the trigger only when another tab is active", () => {
    const other = renderMenu({ runs: { b: makeRun("b", {}) } });
    expect(other.button.querySelector("span")).toBeTruthy();

    const self = renderMenu({ runs: { a: makeRun("a", {}) } });
    expect(self.button.querySelector("span")).toBeNull();
  });

  it("switches to the run menu on hover while another menu-bar menu is open (design 028 §5.6)", () => {
    const { button, props } = renderMenu({ activeMenu: "file" });
    expect(menuEl()).toBeNull();

    fireEvent.mouseEnter(button);

    expect(menuEl()).toBeTruthy();
    // The sibling menu is disarmed so only one menu is ever open.
    expect(props.setActiveMenu).toHaveBeenCalledWith(null);
  });

  it("does not open on hover when no menu is open, even after a menu was activated", () => {
    // Regression: `isMenuActivated` is sticky (never reset), so using it as the
    // hover guard expanded the run menu on a bare hover after the first click
    // of the session — "sometimes you must click, sometimes you don't".
    const { button } = renderMenu({
      activeMenu: null,
      isMenuActivated: true,
    });
    fireEvent.mouseEnter(button);
    expect(menuEl()).toBeNull();

    fireEvent.click(button);
    expect(menuEl()).toBeTruthy();
  });
});

describe("update check feedback on the Help button (design 022 §5.4)", () => {
  /**
   * The Help button is the other `aria-haspopup="menu"` trigger, so it is
   * addressed through its own `data-checking` marker.
   */
  const helpButton = (container: HTMLElement) =>
    container.querySelector(
      '[aria-haspopup="menu"][data-checking]',
    ) as HTMLButtonElement;

  it("runs the shared bottom line while a check is in flight", () => {
    const { container } = renderMenu({ isCheckingUpdate: true });
    const help = helpButton(container);

    expect(help).toBeTruthy();
    expect(help.getAttribute("data-checking")).toBe("true");
    // Same 2px indeterminate line as the execute button runs.
    expect(help.className).toContain("update-busy");
    // `::after` needs a positioning context and must not spill past the button.
    expect(help.className).toContain("relative");
    expect(help.className).toContain("overflow-hidden");
  });

  it("stays clickable while a check is in flight (a slow check must not lock Help away)", () => {
    const { container, props } = renderMenu({ isCheckingUpdate: true });
    const help = helpButton(container);

    // The in-flight line is purely additive: the entry is never disabled and
    // never dims to a non-interactive colour.
    expect(help).not.toBeDisabled();
    expect(help.className).not.toContain("cursor-not-allowed");
    expect(help.className).not.toContain("text-muted-foreground/40");

    // Clicking it still drives the menu (`activeMenu` is a controlled prop, so
    // the assertion is on the callback rather than on local state).
    fireEvent.click(help);
    expect(props.setActiveMenu).toHaveBeenCalledWith("help");
  });

  it("keeps the Help menu reachable while a check is in flight", () => {
    // `activeMenu` is owned by the caller, so render the open state directly:
    // the menu must still hold every entry (View Example + Help Center + Check
    // Update) while a check is running. Addressed by the `data-checking` trigger
    // rather than by localized text so the assertion stays language-agnostic.
    const { container } = renderMenu({
      isCheckingUpdate: true,
      activeMenu: "help",
    });

    const menu = container.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();
    expect(Array.from(menu!.querySelectorAll('[role="menuitem"]')).length).toBe(
      5,
    );
  });

  it("carries no in-flight marker when idle", () => {
    const { container } = renderMenu({ isCheckingUpdate: false });
    const help = helpButton(container);

    expect(help.getAttribute("data-checking")).toBe("false");
    expect(help.className).not.toContain("update-busy");
  });

  it("keeps the check marker off the execute button, which stays `data-busy`", () => {
    const { container } = renderMenu({ isCheckingUpdate: true });

    // The execute button is still the only `data-busy` trigger — the update
    // check must not be mistaken for a pipeline run.
    const busy = container.querySelectorAll("[data-busy]");
    expect(busy.length).toBe(1);
    expect(busy[0].textContent).not.toContain("Help");
    expect(helpButton(container).hasAttribute("data-busy")).toBe(false);
  });
});

describe("settings entry in the toolbar", () => {
  /** Located by its accessible name, since the label is no longer visible. */
  const settingsButton = (container: HTMLElement) =>
    container.querySelector(
      'button[aria-label="Settings"]',
    ) as HTMLButtonElement | null;

  /** The 12px "open" bar rendered as a child span, if present. */
  const underline = (button: HTMLButtonElement) =>
    button.querySelector("span.rounded-full") as HTMLSpanElement | null;

  it("is icon-only with an accessible name instead of a text label", () => {
    const { container } = renderMenu();
    const settings = settingsButton(container);

    expect(settings).toBeTruthy();
    // No visible text — the label lives on the icon's `aria-label`/tooltip.
    expect(settings!.textContent).toBe("");
    expect(settings!.querySelector("svg")).toBeTruthy();
  });

  it("sits last in the right-hand group, right of the AI toggle", () => {
    const { container } = renderMenu();
    const group = container.querySelector("button[aria-label='Settings']")!
      .parentElement!.parentElement!;
    const groupButtons = Array.from(group.querySelectorAll("button"));

    // Order: command panel, log panel, AI, settings.
    expect(groupButtons[groupButtons.length - 1]).toBe(
      settingsButton(container),
    );
  });

  it("opens settings when clicked", () => {
    const { container, props } = renderMenu();
    fireEvent.click(settingsButton(container)!);

    expect(props.onShowSettings).toHaveBeenCalledTimes(1);
  });

  it("highlights while the settings dialog is open, like the panel toggles", () => {
    const closed = renderMenu({ showSettingsDialog: false });
    const closedClass = settingsButton(closed.container)!.className;
    closed.unmount();

    const open = renderMenu({ showSettingsDialog: true });
    const settings = settingsButton(open.container)!;
    const openClass = settings.className;

    // `commandButtonClass(active)` swaps the hover style for the pressed look,
    // using the same 12% ink the menu triggers use when open.
    expect(openClass).toContain("bg-primary/12");
    expect(openClass).not.toContain("hover:bg-primary/10");
    expect(closedClass).not.toContain("bg-primary/12");
    expect(closedClass).toContain("hover:bg-primary/10");
    expect(settings.getAttribute("aria-expanded")).toBe("true");

    // The 12px underline that marks a toggle as "open" rather than "hovered".
    expect(underline(settings)).toBeTruthy();
  });

  it("carries the same open-state underline as the panel toggles", () => {
    // All four right-hand buttons must agree: one 12px bar, same classes.
    const { container } = renderMenu({
      showSettingsDialog: true,
      showCommandPanel: true,
      showLogPanel: true,
      showAIPanel: true,
    });

    const group = container.querySelector("button[aria-label='Settings']")!
      .parentElement!.parentElement!;
    const buttons = Array.from(group.querySelectorAll("button"));
    expect(buttons.length).toBe(4);

    const shapes = buttons.map((button) => {
      const bar = underline(button);
      return bar ? bar.className : null;
    });

    // Every button renders the indicator, and they are byte-identical classes.
    expect(shapes.every((shape) => shape !== null)).toBe(true);
    expect(new Set(shapes).size).toBe(1);
  });

  it("renders no underline while the settings dialog is closed", () => {
    const { container } = renderMenu({ showSettingsDialog: false });
    expect(underline(settingsButton(container)!)).toBeNull();
  });
});

/**
 * Design 054: the five dropdowns got keyboard walking and a rail that says
 * "a panel behind this menu is open".
 */
describe("menu-bar dropdowns (design 054)", () => {
  const trigger = (container: HTMLElement, menu: string) =>
    container.querySelector<HTMLElement>(`[data-menu-trigger="${menu}"]`)!;

  it("walks the open dropdown with arrows and skips disabled entries", () => {
    // An empty pipeline disables 保存为脚本 / 导出工作流, leaving four items.
    renderMenu({ activeMenu: "file", currentPipelineLength: 0 });

    const enabled = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="menu"] button:not([disabled])',
        ),
      );
    // Index into the enabled list: locale-independent, and index 3 proves the
    // two disabled rows were stepped over rather than focused.
    const at = () => enabled().indexOf(document.activeElement as HTMLElement);

    expect(enabled().length).toBe(4);
    const visited: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(window, { key: "ArrowDown" });
      visited.push(at());
    }

    expect(visited).toEqual([0, 1, 2, 3, 0]);
  });

  it("returns focus to the trigger when Escape closes the menu", () => {
    const { container, props } = renderMenu({ activeMenu: "tools" });
    const view = trigger(container, "tools");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).not.toBe(view);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.setActiveMenu).toHaveBeenCalledWith(null);
    expect(document.activeElement).toBe(view);
  });

  it("marks the 查看 trigger when one of its panels is open", () => {
    const closed = renderMenu({ activeMenu: null });
    expect(trigger(closed.container, "view").querySelector("span")).toBeNull();
    closed.unmount();

    const open = renderMenu({ showDataProfile: true });
    const rail = trigger(open.container, "view").querySelector("span");
    expect(rail).not.toBeNull();
    // Same 12px bar the toolbar toggles use, so the bar reads as one system.
    expect(rail!.className).toContain("bottom-0.5");
    expect(rail!.className).toContain("bg-primary");
  });
});
