import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { translations } from "@/i18n/translations";
import { RunPanel } from "@/modules/runs/RunPanel";
import type { BranchRunState } from "@/types/execution";

const copy = translations.en;

function branch(
  index: number,
  status: BranchRunState["status"],
  patch: Partial<BranchRunState> = {},
): BranchRunState {
  return {
    index,
    status,
    steps: [
      { id: `s${index}`, name: `step-${index}`, status: "done" },
    ],
    ...patch,
  };
}

function renderPanel(
  branches: BranchRunState[],
  overrides: Partial<ComponentProps<typeof RunPanel>> = {},
) {
  const props = {
    branches,
    unselectedCount: 0,
    unselectedIndexes: [],
    hasResult: () => true,
    ...overrides,
  };
  return render(
    <LanguageProvider>
      <RunPanel {...props} />
    </LanguageProvider>,
  );
}

describe("RunPanel (design 086)", () => {
  it("lists only the branches it is given, with status and result actions", () => {
    const onOpenResult = vi.fn();
    renderPanel(
      [branch(0, "done"), branch(1, "running", { startedAt: Date.now() })],
      { onOpenResult },
    );

    const rows = document.querySelectorAll("[data-branch-index]");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-status")).toBe("done");
    expect(rows[0].textContent).toContain("step-0");
    expect(rows[0].textContent).toContain(copy.runStateDone);
    expect(rows[0].textContent).toContain(copy.results);
    expect(rows[1].textContent).toContain(copy.runStateRunning);

    fireEvent.click(
      Array.from(rows[0].querySelectorAll("button")).find(
        (button) => button.textContent === copy.results,
      )!,
    );
    expect(onOpenResult).toHaveBeenCalledWith(0);
  });

  it("keeps unselected branches in one footer line and runs them on demand", () => {
    const onRunRemaining = vi.fn();
    renderPanel([branch(0, "done")], {
      unselectedCount: 2,
      unselectedIndexes: [1, 2],
      onRunRemaining,
    });

    expect(
      screen.getByText(copy.runUnselectedHint.replace("{count}", "2")),
    ).toBeTruthy();
    fireEvent.click(screen.getByText(copy.runRemaining));
    expect(onRunRemaining).toHaveBeenCalledWith([1, 2]);
  });

  it("offers a rerun for finished branches only", () => {
    const onRerun = vi.fn();
    const done = renderPanel([branch(0, "done"), branch(1, "done")], {
      onRerun,
    });
    expect(screen.getAllByText(copy.runRerunBranch)).toHaveLength(2);
    fireEvent.click(screen.getAllByText(copy.runRerunBranch)[0]);
    expect(onRerun).toHaveBeenCalledWith(0);
    done.unmount();

    renderPanel(
      [branch(0, "done"), branch(1, "running", { startedAt: Date.now() })],
      { onRerun },
    );
    expect(screen.queryByText(copy.runRerunBranch)).toBeNull();
  });

  it("shows the failure text in the current-step column", () => {
    renderPanel([
      branch(0, "error", { error: 'sort: column "金额" is not numeric' }),
    ]);
    const row = document.querySelector("[data-branch-index]")!;
    expect(row.textContent).toContain('column "金额" is not numeric');
    expect(row.getAttribute("data-status")).toBe("error");
  });
});
