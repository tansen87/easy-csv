import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { translations } from "@/i18n/translations";
import { LogPanel } from "@/modules/logs/LogPanel";
import type { LogEntry } from "@/types/xan";
import {
  buildLogGroups,
  filterLogs,
  levelTotals,
} from "@/modules/logs/lib/logGroups";

/**
 * Log drawer: one execution run = one collapsible group,
 * level chips + tab scope + search AND-combine, disk-backfilled lines are
 * read-only. The 028 tab-scope semantics survive unchanged (see filterLogs
 * tests here and the group headers carrying the tab name).
 */

function makeLog(
  id: string,
  message: string,
  opts: Partial<Omit<LogEntry, "id" | "message">> = {},
): LogEntry {
  return {
    id,
    timestamp: new Date("2026-11-22T14:32:08"),
    type: "info",
    message,
    ...opts,
  };
}

function renderPanel(logs: LogEntry[], selectedTabId?: string) {
  return render(
    <LanguageProvider>
      <LogPanel
        logs={logs}
        onClear={vi.fn()}
        onRemoveLog={vi.fn()}
        isVisible
        onClose={vi.fn()}
        selectedTabId={selectedTabId}
        tabs={[
          { id: "a", name: "Tab A" },
          { id: "b", name: "Tab B" },
        ]}
      />
    </LanguageProvider>,
  );
}

describe("log groups (design 071, pure logic)", () => {
  const tabNames = new Map([
    ["a", "Tab A"],
    ["b", "Tab B"],
  ]);

  it("groups by runId, falls back to per-tab and app groups", () => {
    const logs = [
      makeLog("1", "start", { tabId: "a", runId: "r1" }),
      makeLog("2", "done", {
        tabId: "a",
        runId: "r1",
        type: "success",
        timestamp: new Date("2026-11-22T14:33:08"),
      }),
      makeLog("3", "start", {
        tabId: "b",
        runId: "r2",
        type: "error",
        timestamp: new Date("2026-11-22T14:34:08"),
      }),
      makeLog("4", "loose tab line", { tabId: "a" }),
      makeLog("5", "app line"),
    ];
    const groups = buildLogGroups(logs, tabNames, "应用");
    // Oldest-first, top → bottom: `startedAt` ascending (stable on ties).
    expect(groups.map((g) => g.key)).toEqual([
      "run:r1",
      "tab:a",
      "app",
      "run:r2",
    ]);
    const r1 = groups.find((g) => g.key === "run:r1")!;
    expect(r1.label).toBe("Tab A");
    expect(r1.status).toBe("success");
    expect(r1.entries).toHaveLength(2);
    const r2 = groups.find((g) => g.key === "run:r2")!;
    expect(r2.status).toBe("error");
    expect(groups.find((g) => g.key === "app")!.label).toBe("应用");
  });

  it("computes chip totals", () => {
    const logs = [
      makeLog("1", "a", { type: "info" }),
      makeLog("2", "b", { type: "error" }),
      makeLog("3", "c", { type: "error" }),
    ];
    expect(levelTotals(logs)).toEqual({
      info: 1,
      success: 0,
      warning: 0,
      error: 2,
    });
  });

  it("combines level, tab scope and query with AND", () => {
    const logs = [
      makeLog("1", "delimiter mismatch", { tabId: "a", type: "error" }),
      makeLog("2", "delimiter ok", { tabId: "a", type: "info" }),
      makeLog("3", "delimiter other tab", { tabId: "b", type: "error" }),
    ];
    expect(
      filterLogs(logs, "error", "all", undefined, "delimiter"),
    ).toHaveLength(2);
    expect(
      filterLogs(logs, "error", "current", "a", "delimiter"),
    ).toHaveLength(1);
    expect(filterLogs(logs, "all", "current", "a", "")).toHaveLength(2);
    // Multi-term queries are AND, literal and case-insensitive.
    expect(filterLogs(logs, "all", "all", undefined, "Delimiter MIS")).toHaveLength(1);
    expect(filterLogs(logs, "all", "all", undefined, "nope delimiter")).toHaveLength(0);
  });
});

describe("LogPanel run groups (design 071)", () => {
  const logs = [
    makeLog("1", "line from A", { tabId: "a", runId: "r1" }),
    makeLog("2", "line from B", { tabId: "b", runId: "r2", type: "error" }),
    makeLog("3", "app level line"),
  ];

  it("renders one header per run with the tab name; lines carry no badge", () => {
    const { container } = renderPanel(logs);
    expect(container.textContent).toContain("Tab A");
    expect(container.textContent).toContain("Tab B");
    expect(container.textContent).toContain("line from A");
    expect(container.textContent).toContain("app level line");
    // The old per-line tab badge is gone — grouping owns the tab name.
    const lines = container.querySelectorAll("p");
    expect(lines).toHaveLength(3);
  });

  it("starts below the menu bar when maximized (design 076)", () => {
    const { getByTestId, getByLabelText } = renderPanel(logs);
    const panel = getByTestId("log-panel");
    expect(panel.style.top).toBe("");

    fireEvent.click(getByLabelText(translations.en.maximize));
    // The window chrome must stay reachable while reading logs.
    expect(panel.style.top).toBe("36px");
    expect(panel.style.height).toBe("calc(100vh - 36px)");
    expect(panel.style.bottom).toBe("");

    fireEvent.click(getByLabelText(translations.en.restore));
    expect(panel.style.top).toBe("");
    expect(panel.style.bottom).toBe("0px");
  });

  it("level chips filter the list", () => {
    const { container } = renderPanel(logs);
    fireEvent.click(container.querySelector('[data-level="error"]')!);
    expect(container.textContent).toContain("line from B");
    expect(container.textContent).not.toContain("line from A");
    fireEvent.click(container.querySelector('[data-level="all"]')!);
    expect(container.textContent).toContain("line from A");
  });

  it("tab scope keeps the 028 semantics (current tab only, app lines hidden)", () => {
    const { container } = renderPanel(logs, "a");
    fireEvent.click(container.querySelector('[data-scope="current"]')!);
    expect(container.textContent).toContain("line from A");
    expect(container.textContent).not.toContain("line from B");
    expect(container.textContent).not.toContain("app level line");
  });

  it("search filters and highlights hits; Esc in the field clears it", () => {
    const { container } = renderPanel(logs);
    const input = container.querySelector("input")!;
    fireEvent.change(input, { target: { value: "B" } });
    expect(container.textContent).toContain("line from B");
    expect(container.textContent).not.toContain("line from A");
    expect(container.querySelectorAll("mark")).toHaveLength(1);
    expect(container.querySelectorAll("[data-log-hit]")).toHaveLength(1);

    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
    expect(container.textContent).toContain("line from A");
  });

  it("disk-backfilled lines are read-only, live lines are removable", () => {
    const onRemoveLog = vi.fn();
    const { container } = render(
      <LanguageProvider>
        <LogPanel
          logs={[
            makeLog("disk-1", "from disk", { tabId: "a", fromDisk: true }),
            makeLog("live-1", "live line", { tabId: "a" }),
          ]}
          onClear={vi.fn()}
          onRemoveLog={onRemoveLog}
          isVisible
          onClose={vi.fn()}
          tabs={[{ id: "a", name: "Tab A" }]}
        />
      </LanguageProvider>,
    );
    // 1 delete button for the live line only; the disk badge shows once.
    // (The test env follows the system locale — English UI labels.)
    const buttons = container.querySelectorAll('button[aria-label="Remove"]');
    expect(buttons.length).toBe(1);
    expect(container.textContent).toContain("from disk");
    fireEvent.click(buttons[0]);
    expect(onRemoveLog).toHaveBeenCalledWith("live-1");
  });

  it("collapses a group by its header", () => {
    const { container } = renderPanel(logs);
    const groupHeader = container.querySelector(
      '[data-log-group="run:r1"] button',
    )!;
    fireEvent.click(groupHeader);
    expect(container.textContent).not.toContain("line from A");
    expect(container.textContent).toContain("line from B");
    fireEvent.click(groupHeader);
    expect(container.textContent).toContain("line from A");
  });

  it("清空 clears everything directly, disk lines included (071)", () => {
    const onClear = vi.fn();
    const { container } = render(
      <LanguageProvider>
        <LogPanel
          logs={[
            makeLog("disk-1", "from disk", { tabId: "a", fromDisk: true }),
            makeLog("live-1", "live line", { tabId: "a" }),
          ]}
          onClear={onClear}
          onRemoveLog={vi.fn()}
          isVisible
          onClose={vi.fn()}
          tabs={[{ id: "a", name: "Tab A" }]}
        />
      </LanguageProvider>,
    );
    // One click, no dialog: the button clears every visible line.
    fireEvent.click(container.querySelector('button[aria-label="Clear"]')!);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Clear logs");
  });
});
