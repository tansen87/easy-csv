import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { LanguageProvider } from "@/i18n";
import { translations } from "@/i18n/translations";
import type { ResultPreview } from "@/types/execution";
import type { LogEntry } from "@/types/xan";
import { BottomDock } from "@/components/layout/BottomDock";
import { LogPanel } from "@/modules/logs/LogPanel";
import { ResultMeta, ResultsPanel } from "@/modules/results/ResultsPanel";
import {
  isNumericColumn,
  resultPanelHeight,
  stripLeadingIndex,
  toCsvText,
  toMarkdownText,
} from "@/modules/results/lib/resultTable";

/**
 * Design 084: results live in the bottom dock. 日志 is always the first tab,
 * results follow; the chain, counts and copy sit **in the tab row** (one row,
 * not two). The table is a ledger: numbers right aligned, one rule under the
 * head, blanks marked with a hairline.
 */

// The test env follows the system locale: assertions use the English copy.
const t = translations.en;

function makeResult(overrides: Partial<ResultPreview> = {}): ResultPreview {
  return {
    id: "result-1-0",
    label: "Result: 去掉空金额 → 去重 → 按地区汇总",
    steps: ["去掉空金额", "去重", "按地区汇总"],
    headers: ["地区", "金额合计"],
    rows: [
      ["西南", "508827.25"],
      ["华东", "556674.98"],
      ["", "12131.16"],
    ],
    totalRows: 3,
    truncated: false,
    ...overrides,
  };
}

const renderMeta = (result: ResultPreview, index = 0) =>
  render(
    <LanguageProvider>
      <ResultMeta result={result} index={index} />
    </LanguageProvider>,
  );

const renderPanel = (result: ResultPreview) =>
  render(
    <LanguageProvider>
      <ResultsPanel result={result} />
    </LanguageProvider>,
  );

describe("result ledger helpers", () => {
  it("treats a column as numeric only when every non-empty value parses", () => {
    const rows = [["1"], ["", "2"], ["-3.5"], ["1e3"]];
    expect(isNumericColumn(rows, 0)).toBe(true);
    // `1,200` / `¥12` / `N/A` are text: alignment must not reformat them.
    expect(isNumericColumn([["1,200"], ["2"]], 0)).toBe(false);
    expect(isNumericColumn([["¥12"]], 0)).toBe(false);
    expect(isNumericColumn([["N/A"]], 0)).toBe(false);
    // A column of nothing but blanks is not numeric either.
    expect(isNumericColumn([[""], ["   "]], 0)).toBe(false);
  });

  it("quotes only the cells that need it and keeps the original text", () => {
    expect(toCsvText(["a", "b"], [["1,200", 'say "hi"']])).toBe(
      'a,b\n"1,200","say ""hi"""',
    );
    expect(toMarkdownText(["a|b"], [["x|y"]])).toBe(
      "| a\\|b |\n| --- |\n| x\\|y |",
    );
  });

  it("drops a step's own number only when it matches its position", () => {
    // The sample pipeline names steps "1 去掉空金额": the chain already shows
    // `01`, so the prefix would read "01 1 去掉空金额".
    expect(stripLeadingIndex("1 去掉空金额", 1)).toBe("去掉空金额");
    expect(stripLeadingIndex("2. 去重", 2)).toBe("去重");
    expect(stripLeadingIndex("03、汇总", 3)).toBe("汇总");
    // Mismatched or non-numeric prefixes are data, not decoration.
    expect(stripLeadingIndex("2026 汇总", 1)).toBe("2026 汇总");
    expect(stripLeadingIndex("按地区汇总金额", 3)).toBe("按地区汇总金额");
  });

  it("sizes the dock for the visible rows, capped at 8", () => {
    // 5 grip + 32 header row (chain lives in it) + 32 head + rows*30
    expect(resultPanelHeight(6)).toBe(249);
    expect(resultPanelHeight(20)).toBe(resultPanelHeight(8));
  });
});

describe("result meta row (design 084)", () => {
  it("renders the step chain and the preview counts", () => {
    const { getByText } = renderMeta(makeResult());
    expect(getByText("去掉空金额")).toBeTruthy();
    expect(getByText("按地区汇总")).toBeTruthy();
    expect(getByText("3 rows × 2 cols")).toBeTruthy();
  });

  it("says 前 N 行 when the preview is truncated", () => {
    const { getByText } = renderMeta(
      makeResult({ truncated: true, totalRows: 500 }),
      1,
    );
    expect(getByText("first 500 rows × 2 cols")).toBeTruthy();
  });

  it("explains the copy button with the app tooltip, not a native title", () => {
    const { getByLabelText, getByText, queryByText } = renderMeta(makeResult());
    const button = getByLabelText(t.copyCsv);
    // Native `title` bubbles never match the app's tooltips (design 084).
    expect(button.getAttribute("title")).toBeNull();
    expect(queryByText(t.copyCsv)).toBeNull();

    fireEvent.mouseEnter(button.parentElement!);
    expect(getByText(t.copyCsv)).toBeTruthy();
  });

  it("copies CSV from the main button and Markdown from the menu", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const { getByLabelText, getByRole } = renderMeta(makeResult());

    fireEvent.click(getByLabelText(t.copyCsv));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(
      "地区,金额合计\n西南,508827.25\n华东,556674.98\n,12131.16",
    );

    fireEvent.click(getByLabelText(t.copy));
    fireEvent.click(getByRole("menuitem", { name: t.copyMarkdown }));
    await Promise.resolve();
    expect(writeText).toHaveBeenLastCalledWith(
      [
        "| 地区 | 金额合计 |",
        "| --- | --- |",
        "| 西南 | 508827.25 |",
        "| 华东 | 556674.98 |",
        "|  | 12131.16 |",
      ].join("\n"),
    );
  });
});

describe("results table (design 084)", () => {
  it("renders one row per record and right-aligns numeric cells", () => {
    const { container, getByText } = renderPanel(makeResult());
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(getByText("508827.25").className).toContain("text-right");
  });

  it("marks blanks with a hairline instead of an empty square", () => {
    const { container } = renderPanel(makeResult());
    expect(
      container.querySelectorAll('tbody span[aria-hidden="true"]').length,
    ).toBe(1);
  });

  it("scrolls through the app's ScrollArea, not a native overflow box", () => {
    const { container } = renderPanel(makeResult());
    const panel = container.querySelector('[data-testid="results-panel"]');
    // Radix renders a data attribute on its root; a plain overflow-auto div
    // would not have it (nor the custom thumbs).
    expect(panel?.getAttribute("data-radix-scroll-area-viewport")).toBeNull();
    expect(
      container.querySelector("[data-radix-scroll-area-viewport]"),
    ).toBeTruthy();
  });
});

describe("bottom dock (design 084)", () => {
  const tabs = [
    { id: "logs" as const, label: t.logs, count: 12 },
    { id: "result:0" as const, label: t.results, count: 3 },
  ];

  it("names the active panel in the switcher and lists 日志 first", () => {
    const { container, getByText } = render(
      <LanguageProvider>
        <BottomDock
          open
          activeTab="result:0"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
          tabs={tabs}
          label={t.logs}
        >
          <div data-testid="log-body">logs</div>
        </BottomDock>
      </LanguageProvider>,
    );

    // Closed switcher shows the current panel, not every panel.
    const trigger = container.querySelector("[data-dock-switcher]")!;
    expect(trigger.textContent).toContain(t.results);
    expect(container.querySelectorAll("[data-dock-tab]")).toHaveLength(0);

    fireEvent.click(trigger);
    const options = container.querySelectorAll("[data-dock-tab]");
    expect(options[0].getAttribute("data-dock-tab")).toBe("logs");
    expect(options[1].getAttribute("data-dock-tab")).toBe("result:0");

    // Hidden, not unmounted: filters and scroll survive a panel switch.
    expect(getByText("logs")).toBeTruthy();
    expect(getByText("logs").parentElement?.className).toContain("hidden");
  });

  it("renders the tab's meta in the same row as the tabs", () => {
    const { container } = render(
      <LanguageProvider>
        <BottomDock
          open
          activeTab="result:0"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
          tabs={tabs}
          meta={<span data-testid="dock-meta">3 rows × 2 cols</span>}
        >
          <div>logs</div>
        </BottomDock>
      </LanguageProvider>,
    );

    const meta = container.querySelector('[data-testid="dock-meta"]')!;
    const row = meta.parentElement!.parentElement!;
    // One head row only: the meta sits beside the switcher, not under it.
    expect(row.querySelector("[data-dock-switcher]")).toBeTruthy();
    expect(row.className).toContain("h-8");
  });

  it("reports tab changes and closing", () => {
    const onTabChange = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <LanguageProvider>
        <BottomDock
          open
          activeTab="logs"
          onTabChange={onTabChange}
          onClose={onClose}
          tabs={tabs}
          label={t.logs}
        >
          <div>logs</div>
        </BottomDock>
      </LanguageProvider>,
    );

    fireEvent.click(container.querySelector("[data-dock-switcher]")!);
    fireEvent.click(container.querySelector('[data-dock-tab="result:0"]')!);
    expect(onTabChange).toHaveBeenCalledWith("result:0");

    fireEvent.click(
      container.querySelector(`[aria-label="${t.close}"]`) as HTMLElement,
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    const { container } = render(
      <LanguageProvider>
        <BottomDock
          open={false}
          activeTab="logs"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
          tabs={tabs}
          label={t.logs}
        >
          <div>logs</div>
        </BottomDock>
      </LanguageProvider>,
    );
    expect(container.querySelector('[data-testid="bottom-dock"]')).toBeNull();
  });
});

describe("log toolbar in the dock header (design 084)", () => {
  const logs: LogEntry[] = [
    {
      id: "l1",
      timestamp: new Date("2026-11-28T09:00:00"),
      type: "success",
      message: "done",
      tabId: "a",
      runId: "r1",
    },
  ];

  const renderDock = (embeddedActive: boolean) =>
    render(
      <LanguageProvider>
        <BottomDock
          open
          activeTab="logs"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
          tabs={[{ id: "logs", label: t.logs, count: logs.length }]}
        >
          <LogPanel
            embedded
            embeddedActive={embeddedActive}
            logs={logs}
            onClear={vi.fn()}
            onRemoveLog={vi.fn()}
            isVisible
            onClose={vi.fn()}
            tabs={[{ id: "a", name: "Tab A" }]}
            selectedTabId="a"
          />
        </BottomDock>
      </LanguageProvider>,
    );

  it("portals the filters out of the log body and into the tab row", () => {
    const { container } = renderDock(true);
    const chip = container.querySelector('[data-level="all"]')!;
    expect(chip).toBeTruthy();

    // Still inside the dock…
    expect(
      container.querySelector('[data-testid="bottom-dock"]')!.contains(chip),
    ).toBe(true);
    // …but not inside the log panel: that is the second row we removed.
    expect(
      container.querySelector('[data-testid="log-panel"]')!.contains(chip),
    ).toBe(false);
  });

  it("hides the toolbar while another tab is active", () => {
    const { queryByText } = renderDock(false);
    expect(queryByText(t.allLogs)).toBeNull();
  });
});
