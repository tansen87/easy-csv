import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { LogPanel } from "@/modules/logs/LogPanel";
import type { LogEntry } from "@/types/xan";

/**
 * Per-tab log scope (design 028 §5.4).
 *
 * Real-time logs stay one stream, but every line carries the tab that produced
 * it, so the panel can either show everything or only the current tab.
 */

function makeLog(id: string, message: string, tabId?: string): LogEntry {
  return { id, timestamp: new Date(0), type: "info", message, tabId };
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

describe("LogPanel tab scope (design 028 §5.4)", () => {
  const logs = [
    makeLog("1", "line from A", "a"),
    makeLog("2", "line from B", "b"),
    makeLog("3", "app level line"),
  ];

  it("tags each line with its tab and can scope to the current tab", () => {
    const { container } = renderPanel(logs, "a");

    // Everything shows by default, each run line carrying its tab name.
    expect(container.textContent).toContain("line from A");
    expect(container.textContent).toContain("line from B");
    expect(container.textContent).toContain("Tab A");
    expect(container.textContent).toContain("Tab B");

    fireEvent.click(container.querySelector('[data-scope="current"]')!);
    expect(container.textContent).toContain("line from A");
    expect(container.textContent).not.toContain("line from B");
    // App-level lines have no tab and are hidden by the scope.
    expect(container.textContent).not.toContain("app level line");

    fireEvent.click(container.querySelector('[data-scope="all"]')!);
    expect(container.textContent).toContain("line from B");
    expect(container.textContent).toContain("app level line");
  });

  it("keeps every line when no tab is selected", () => {
    const { container } = renderPanel(logs, undefined);
    fireEvent.click(container.querySelector('[data-scope="current"]')!);
    expect(container.textContent).toContain("line from B");
  });
});