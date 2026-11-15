import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { ExpressionEditor } from "@/components/expression/ExpressionEditor";

function Harness({
  initial = "",
  columns = ["country", "amount"],
  onChange,
}: {
  initial?: string;
  columns?: string[];
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <LanguageProvider>
      <ExpressionEditor
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        columns={columns}
      />
    </LanguageProvider>
  );
}

function getTextarea(): HTMLTextAreaElement {
  return screen.getByRole("textbox") as HTMLTextAreaElement;
}

describe("ExpressionEditor", () => {
  it("does not open suggestions for an empty word", () => {
    render(<Harness />);
    const ta = getTextarea();
    fireEvent.change(ta, { target: { value: " ", selectionStart: 1 } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("anchors the list to the typed word and collapses duplicate labels", () => {
    render(<Harness />);
    const ta = getTextarea();
    fireEvent.change(ta, { target: { value: "co", selectionStart: 2 } });

    const list = screen.getByRole("listbox");
    expect(list).toBeTruthy();
    // Two `count` entries exist in the vocabulary; only one row survives.
    expect(screen.getAllByRole("option", { name: "count" })).toHaveLength(1);
    // Type codes replace the old coloured pills.
    expect(screen.getAllByText("fn").length).toBeGreaterThan(0);
  });

  it("accepts the highlighted suggestion with Tab", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const ta = getTextarea();
    fireEvent.change(ta, { target: { value: "co", selectionStart: 2 } });
    fireEvent.keyDown(ta, { key: "Tab" });

    const calls = onChange.mock.calls;
    const next = calls[calls.length - 1]?.[0] as string;
    expect(next).toMatch(/^co\w*\($/);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps Enter as a newline instead of accepting a suggestion", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const ta = getTextarea();
    fireEvent.change(ta, { target: { value: "co", selectionStart: 2 } });
    fireEvent.keyDown(ta, { key: "Enter" });

    const calls = onChange.mock.calls;
    expect(calls[calls.length - 1]?.[0]).toBe("co\n");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows the function signature and the active parameter under the editor", () => {
    render(<Harness />);
    const ta = getTextarea();
    const expression = 'strftime(col("日期"), ';
    fireEvent.change(ta, {
      target: { value: expression, selectionStart: expression.length },
    });

    expect(screen.getByText("strftime(")).toBeTruthy();
    expect(screen.getByText("format")).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("says so when nothing matches", () => {
    render(<Harness />);
    const ta = getTextarea();
    fireEvent.change(ta, { target: { value: "zz", selectionStart: 2 } });

    const list = screen.getByRole("listbox");
    expect(list.textContent).toMatch(/No match|无匹配/);
  });
});
