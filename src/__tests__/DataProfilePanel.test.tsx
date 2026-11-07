import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { LanguageProvider } from "@/i18n";
import { DataProfilePanel } from "@/modules/data-preview/DataProfilePanel";

/**
 * Data profile panel (design 042).
 *
 * `xan stats` reports `count` as the number of **non-empty** values, so the
 * panel must derive the file's row count from `count + count_empty`; the old
 * card layout showed `count` alone and under-reported rows for any column with
 * holes. Everything else here checks the list/expand/sort/refresh contract.
 */

const STATS_CSV = [
  "field,type,types,count,count_empty,sum,mean,min,max,variance,stddev,lex_first,lex_last,min_length,max_length",
  '金额,Float,Float,12384,96,15435171.84,1246.38,0.9,48690,1,1,,,4,9',
  '地区,Text,Text,12468,12,,,,,,,,东北,西南,2,2',
  "内部标记,Empty,Empty,0,12480,,,,,,,,0,0",
].join("\n");

const invokeMock = vi.mocked(invoke);

function renderPanel(overrides: Record<string, unknown> = {}) {
  return render(
    <LanguageProvider>
      <DataProfilePanel
        filePath="/data/orders_2026-10.csv"
        delimiter=","
        isVisible
        onClose={vi.fn()}
        {...overrides}
      />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("easy-csv-language", "zh");
  invokeMock.mockReset();
  invokeMock.mockImplementation(((cmd: string) => {
    switch (cmd) {
      case "load_profile_cache":
        return Promise.resolve(null);
      case "profile_csv":
        return Promise.resolve(STATS_CSV);
      default:
        return Promise.resolve(undefined);
    }
  }) as never);
});

afterEach(() => {
  localStorage.clear();
});

describe("DataProfilePanel", () => {
  it("counts rows as count + count_empty and lists every column", async () => {
    renderPanel();

    // 12,384 + 96 — not the 12,384 `count` alone.
    expect(await screen.findByText(/12,480 行/)).toBeInTheDocument();
    expect(screen.getByText(/3 列 · 3 列有空值/)).toBeInTheDocument();

    expect(screen.getByText("金额")).toBeInTheDocument();
    expect(screen.getByText("地区")).toBeInTheDocument();
    expect(screen.getByText("内部标记")).toBeInTheDocument();
  });

  it("keeps statistics folded until a row is opened", async () => {
    renderPanel();
    const row = await screen.findByRole("button", { name: /金额/ });

    expect(screen.queryByText("1,246.38")).not.toBeInTheDocument();
    fireEvent.click(row);

    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1,246.38")).toBeInTheDocument();
    expect(screen.getByText("15,435,171.84")).toBeInTheDocument();

    fireEvent.click(row);
    expect(screen.queryByText("1,246.38")).not.toBeInTheDocument();
  });

  it("sorts by missing values and explains an all-empty column", async () => {
    renderPanel();
    await screen.findByText("金额");

    fireEvent.click(screen.getByRole("button", { name: "缺失" }));

    const rows = screen.getAllByRole("button", { expanded: false });
    expect(rows[0]).toHaveTextContent("内部标记");

    fireEvent.click(rows[0]);
    expect(
      screen.getByText("整列为空,没有可统计的值"),
    ).toBeInTheDocument();
  });

  it("recomputes from the profile command when refreshed, bypassing the cache", async () => {
    renderPanel();
    await screen.findByText("金额");

    expect(invokeMock).toHaveBeenCalledWith("load_profile_cache", {
      filePath: "/data/orders_2026-10.csv",
      delimiter: ",",
    });

    fireEvent.click(screen.getByRole("button", { name: "重新分析" }));

    await waitFor(() => {
      const profileCalls = invokeMock.mock.calls.filter(
        ([cmd]) => cmd === "profile_csv",
      );
      expect(profileCalls).toHaveLength(2);
    });

    // The cache read only happens for the initial load.
    expect(
      invokeMock.mock.calls.filter(([cmd]) => cmd === "load_profile_cache"),
    ).toHaveLength(1);
  });

  it("surfaces a failed profile with the raw error and a retry", async () => {
    invokeMock.mockImplementation(((cmd: string) => {
      if (cmd === "load_profile_cache") return Promise.resolve(null);
      if (cmd === "profile_csv")
        return Promise.reject(new Error("xan stats failed: bad delimiter"));
      return Promise.resolve(undefined);
    }) as never);

    renderPanel();

    expect(await screen.findByText("无法分析这个文件")).toBeInTheDocument();
    expect(
      screen.getByText(/xan stats failed: bad delimiter/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});
