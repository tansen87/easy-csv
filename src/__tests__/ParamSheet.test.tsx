import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LanguageProvider } from "@/i18n";
import { ThemeProvider } from "@/components/setting/ThemeProvider";
import {
  ParamSheet,
  usesParamSheet,
} from "@/modules/dialogs/command/ParamSheet";
import type { CommandDialogState } from "@/types/dialog";

/**
 * The command-first parameter sheet (design 080 · option C).
 *
 * What matters here is the contract with the run: the tokens are exactly the
 * parameters that will reach argv, the required counter and the copy button
 * follow the same rule, and both ways into a field (the "+" row and a token)
 * open the same editor.
 */

const writeText = vi.fn(async () => {});

/** Controlled host, so a keystroke and its token are observed in one render. */
function Harness({
  initial,
  headers = [],
}: {
  initial: CommandDialogState;
  headers?: string[];
}) {
  const [dialog, setDialog] = useState<CommandDialogState>(initial);
  return (
    <ParamSheet
      commandDialog={dialog}
      onAddCommand={vi.fn()}
      setCommandDialog={setDialog as (next: CommandDialogState | null) => void}
      headers={headers}
    />
  );
}

function renderSheet(initial: CommandDialogState, headers: string[] = []) {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <Harness initial={initial} headers={headers} />
      </LanguageProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  // These assertions read Chinese labels; the provider picks the language up
  // from storage on mount, so pin it before every render.
  localStorage.setItem("easy-csv-language", "zh");
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

describe("ParamSheet · join", () => {
  it("starts with an empty command and the required counter at zero", () => {
    renderSheet({ type: "join", params: {} });

    expect(screen.getByText("xan join")).toBeInTheDocument();
    expect(screen.getByText("必填 0 / 2 已就位")).toBeInTheDocument();
    // The hint names the parameters, not their Chinese labels.
    expect(screen.getByText("还差 input1、input2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加步骤" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /复制命令/ })).toBeDisabled();
  });

  it("adds a field from the list, and typing puts it on the command", () => {
    renderSheet({ type: "join", params: {} });

    fireEvent.click(screen.getByRole("button", { name: "参数 左表文件" }));
    fireEvent.change(screen.getByLabelText("左表文件"), {
      target: { value: "客户明细.csv" },
    });

    expect(screen.getByText("客户明细.csv")).toBeInTheDocument();
    expect(screen.getByText("必填 1 / 2 已就位")).toBeInTheDocument();
    // Still one required field missing, so copying is not offered yet.
    expect(screen.getByRole("button", { name: /复制命令/ })).toBeDisabled();
  });

  it("copies the exact argv once every required field is set", () => {
    renderSheet({
      type: "join",
      params: { columns: "地区", input1: "客户明细.csv", input2: "订单.csv" },
    });

    expect(screen.getByText("必填 2 / 2 已就位")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /复制命令/ }));

    expect(writeText).toHaveBeenCalledWith(
      "xan join 地区 客户明细.csv 订单.csv",
    );
  });

  it("removes a token by its × and drops the value", () => {
    renderSheet({ type: "join", params: { input1: "客户明细.csv" } });

    fireEvent.click(screen.getByRole("button", { name: "移除 左表文件" }));

    expect(screen.queryByText("客户明细.csv")).not.toBeInTheDocument();
    expect(screen.getByText("必填 0 / 2 已就位")).toBeInTheDocument();
  });
});

describe("ParamSheet · dedup", () => {
  it("offers the tab's headers for a column parameter", () => {
    renderSheet({ type: "dedup", params: {} }, ["地区", "客户", "金额"]);

    fireEvent.click(screen.getByRole("button", { name: "参数 去重的列" }));

    const chip = screen.getByRole("button", { name: "客户" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);

    const pressed = screen.getByRole("button", { name: "客户" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("去重的列")).toHaveValue("客户");
  });

  it("has no required fields, so copy is live from the start", () => {
    renderSheet({ type: "dedup", params: {} });
    expect(screen.getByText("无必填项")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /复制命令/ })).toBeEnabled();
  });

  it("puts a flag on the command with one click", () => {
    renderSheet({ type: "dedup", params: {} });

    fireEvent.click(screen.getByRole("button", { name: "参数 只验证不输出" }));

    expect(screen.getByText("--check")).toBeInTheDocument();
  });

  it("edits a flag with a switch, and turning it off drops the token", () => {
    renderSheet({ type: "dedup", params: {} });

    // Adding a flag puts it on the command straight away, so it opens on.
    fireEvent.click(screen.getByRole("button", { name: "参数 只验证不输出" }));
    expect(screen.getByText("--check")).toBeInTheDocument();

    const toggle = screen.getByRole("switch", { name: "只验证不输出" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(
      screen.getByRole("switch", { name: "只验证不输出" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("--check")).not.toBeInTheDocument();
  });
});

describe("usesParamSheet", () => {
  it("drives every command that has no bespoke form", () => {
    expect(usesParamSheet("sort")).toBe(true);
    expect(usesParamSheet("rename")).toBe(true);
    expect(usesParamSheet("to")).toBe(true);
  });

  it("leaves the pickers and panel editors on their own forms", () => {
    expect(usesParamSheet("plot")).toBe(false);
    expect(usesParamSheet("batch-from")).toBe(false);
    expect(usesParamSheet("duckdb")).toBe(false);
  });
});

describe("ParamSheet · a command without curated labels", () => {
  it("explains each parameter with its own description", () => {
    renderSheet({ type: "sort", params: {} });
    // The row is named by its description, which is what the sheet shows.
    expect(
      screen.getByRole("button", { name: "参数 选择要排序的列子集" }),
    ).toBeInTheDocument();
  });
});

describe("ParamSheet · map", () => {
  it("keeps the full expression editor for map's expression field", () => {
    renderSheet({ type: "map", params: {} });

    // map --expression is the one parameter that always had the code editor
    // (design 056); the sheet must not downgrade it to a one-line input.
    const editor = screen.getByPlaceholderText("要评估的表达式");
    expect(editor.tagName).toBe("TEXTAREA");
  });
});
