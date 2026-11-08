import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { VersionControlPanel } from "@/modules/pipeline/panels/VersionControlPanel";
import { PipelineVersion, StoredPipelineStep } from "@/types/xan";

/**
 * Version log.
 *
 * The panel is a commit log: one 56px row per version, diff expanding inside
 * the row, row actions behind a single ⋯ menu. These tests pin the behaviours
 * the redesign introduced (in-row diff, ⋯ menu, empty-message save) plus the
 * two states that used to be plain grey text (empty / no search match).
 */

function step(id: string, alias: string): StoredPipelineStep {
  return { id, commandId: "filter", parameters: { status: "done" }, alias };
}

function version(
  overrides: Partial<PipelineVersion> & { id: string; createdAt: string },
): PipelineVersion {
  return {
    pipelineId: "tab-1",
    steps: [step(`s-${overrides.id}`, "筛选已完成")],
    edges: [],
    ...overrides,
  } as PipelineVersion;
}

// Oldest → newest, the order the hook persists.
const v1 = version({
  id: "v1",
  message: "初稿: 只导入",
  createdAt: "2026-11-04 10:15:00",
  steps: [step("a1", "筛选已完成")],
});
const v2 = version({
  id: "v2",
  parentId: "v1",
  message: "加上去重",
  createdAt: "2026-11-05 18:40:00",
  steps: [step("a1", "筛选已完成"), step("a2", "去重")],
  tags: ["发布前"],
});

type PanelProps = React.ComponentProps<typeof VersionControlPanel>;

function makeProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    versions: [v1, v2],
    currentVersionId: "v2",
    currentSnapshot: { steps: v2.steps, edges: v2.edges },
    onSaveVersion: vi.fn().mockResolvedValue(undefined),
    onRestoreVersion: vi.fn(),
    onDeleteVersion: vi.fn(),
    onClearAllVersions: vi.fn(),
    onAddTag: vi.fn(),
    onRemoveTag: vi.fn(),
    onRenameVersion: vi.fn(),
    isSaving: false,
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const props = makeProps(overrides);
  const utils = render(
    <LanguageProvider>
      <VersionControlPanel {...props} />
    </LanguageProvider>,
  );
  return { ...utils, props };
}

const rowOf = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`[data-version-id="${id}"]`);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("easy-csv-language", "zh");
});

afterEach(() => {
  localStorage.clear();
});

describe("VersionControlPanel log rows", () => {
  it("lists newest first, one row per version, and marks the current one", () => {
    const { container } = renderPanel();
    const rows = container.querySelectorAll("[data-version-id]");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-version-id")).toBe("v2");
    expect(rows[1].getAttribute("data-version-id")).toBe("v1");

    expect(container.textContent).toContain("2 个版本");
    expect(rowOf(container, "v2")!.textContent).toContain("当前");
    expect(rowOf(container, "v2")!.textContent).toContain("2 步");
    expect(rowOf(container, "v2")!.textContent).toContain("发布前");
    expect(rowOf(container, "v1")!.textContent).not.toContain("当前");
  });

  it("shows the unsaved hint only when the workspace differs from the current version", () => {
    const { container, rerender } = renderPanel();
    expect(container.textContent).not.toContain("当前工作区有未保存改动");

    rerender(
      <LanguageProvider>
        <VersionControlPanel
          {...makeProps({
            currentSnapshot: {
              steps: [...v2.steps, step("a3", "排序")],
              edges: [],
            },
          })}
        />
      </LanguageProvider>,
    );
    expect(container.textContent).toContain("当前工作区有未保存改动");
  });

  it("expands the diff inside the row instead of a fixed-height compare block", () => {
    const { container } = renderPanel();
    fireEvent.click(rowOf(container, "v2")!);

    // Added step, rendered as a patch line with its alias — no `key=value`
    // parameter detail (design 044 revision).
    expect(container.textContent).toContain("去重");
    expect(container.textContent).not.toContain("status=");
    expect(container.textContent).toContain("恢复");
    expect(container.textContent).toContain("删除版本");
    expect(rowOf(container, "v2")!.getAttribute("aria-expanded")).toBe("true");

    // The baseline picker is the app's Select (an input-backed combobox), not a
    // native <select>.
    const picker = screen.getByRole("combobox", {
      name: "与当前工作区对比",
    });
    expect(picker.tagName).toBe("INPUT");

    // Clicking again collapses it.
    fireEvent.click(rowOf(container, "v2")!);
    expect(rowOf(container, "v2")!.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("VersionControlPanel row menu", () => {
  it("routes delete through the confirm dialog", async () => {
    const { container, props } = renderPanel();
    fireEvent.click(
      rowOf(container, "v2")!.querySelector('[aria-label="版本操作"]')!,
    );

    const menu = await screen.findByRole("menu");
    fireEvent.click(
      Array.from(menu.querySelectorAll('[role="menuitem"]')).find((item) =>
        item.textContent?.includes("删除版本"),
      )!,
    );

    const dialog = await screen.findByRole("dialog");
    // Design 050: the button names the action, and the dialog names the
    // version it is about instead of pasting it into the question.
    expect(dialog).toHaveAccessibleName("删除版本");
    expect(dialog.textContent).toContain("加上去重");
    fireEvent.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (b) => b.textContent === "删除",
      )!,
    );

    expect(props.onDeleteVersion).toHaveBeenCalledWith("v2");
  });

  it("restores through the confirm dialog", async () => {
    const { container, props } = renderPanel();
    fireEvent.click(
      rowOf(container, "v2")!.querySelector('[aria-label="版本操作"]')!,
    );
    const menu = await screen.findByRole("menu");
    fireEvent.click(
      Array.from(menu.querySelectorAll('[role="menuitem"]')).find((item) =>
        item.textContent?.includes("恢复"),
      )!,
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (b) => b.textContent === "恢复",
      )!,
    );
    expect(props.onRestoreVersion).toHaveBeenCalledWith("v2");
  });
});

describe("VersionControlPanel composer", () => {
  it("saves an untitled version when the message is empty", async () => {
    const { container, props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "保存版本" }));
    // Header button + composer submit both read 保存版本; the submit is last.
    const buttons = screen.getAllByRole("button", { name: "保存版本" });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(props.onSaveVersion).toHaveBeenCalledWith(undefined, []),
    );
    expect(container.textContent).not.toContain("保存当前管道为版本");
  });

  it("collects tags as chips before saving", async () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "保存版本" }));

    const tagInput = screen.getByPlaceholderText("添加标签,回车确认");
    fireEvent.change(tagInput, { target: { value: "q3" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });

    const submit = screen.getAllByRole("button", { name: "保存版本" }).pop()!;
    fireEvent.click(submit);

    await waitFor(() =>
      expect(props.onSaveVersion).toHaveBeenCalledWith(undefined, ["q3"]),
    );
  });
});

describe("VersionControlPanel empty and no-match states", () => {
  it("explains the empty state and offers the save action", () => {
    const { container } = renderPanel({
      versions: [],
      currentVersionId: undefined,
      currentSnapshot: { steps: v2.steps, edges: [] },
    });
    expect(container.textContent).toContain("还没有保存过版本");
    expect(container.textContent).toContain("当前管道 2 个步骤");
    expect(screen.getByRole("button", { name: "保存当前管道" })).toBeTruthy();
  });

  it("keeps the query visible when nothing matches and can clear it", () => {
    const { container } = renderPanel();
    const input = screen.getByPlaceholderText("搜索版本");
    fireEvent.change(input, { target: { value: "透视" } });

    expect(container.textContent).toContain("没有匹配「透视」的版本");
    expect(container.querySelectorAll("[data-version-id]")).toHaveLength(0);

    // Two affordances clear the query: the ✕ in the field and the button in the
    // empty result. Both are labelled the same on purpose.
    const clearButtons = screen.getAllByRole("button", { name: "清除搜索" });
    fireEvent.click(clearButtons[clearButtons.length - 1]);
    expect(container.querySelectorAll("[data-version-id]")).toHaveLength(2);
  });

  it("filters by tag as well as by message", () => {
    const { container } = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("搜索版本"), {
      target: { value: "发布前" },
    });
    expect(container.querySelectorAll("[data-version-id]")).toHaveLength(1);
    expect(container.textContent).toContain("加上去重");
  });
});
