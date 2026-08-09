import { describe, it, expect } from "vitest";
import { StrictMode } from "react";
import { render } from "@testing-library/react";
import {
  HelpMarkdown,
  getSearchMatches,
} from "@/components/help/HelpMarkdown";
import { helpContentEn } from "@/components/help/HelpContent";

const content = [
  "# Hidden Title term",
  "",
  "First term here.",
  "",
  "Second paragraph with term again and `inline term`.",
  "",
  "**bold term** and term in table:",
  "",
  "| a term | b |",
  "|-------|---|",
  "| term x | 1 |",
  "| y term | 2 |",
].join("\n");

describe("HelpMarkdown highlighting", () => {
  it("getSearchMatches excludes the hidden h1 match", () => {
    const matches = getSearchMatches(content, "term");
    expect(matches.length).toBe(8);
    expect(matches[0]).toBeGreaterThan(content.indexOf("First term"));
  });

  it("renders every match and applies current styling under StrictMode", () => {
    const { container } = render(
      <StrictMode>
        <HelpMarkdown content={content} searchQuery="term" currentMatchIndex={0} />
      </StrictMode>,
    );

    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks.length).toBe(getSearchMatches(content, "term").length);

    const active = container.querySelectorAll('[data-active-match="true"]');
    expect(active.length).toBe(1);
    expect(marks[0].classList.contains("bg-orange-500")).toBe(true);
    expect(marks.slice(1).every((m) => m.classList.contains("bg-orange-200"))).toBe(
      true,
    );
  });

  it("renders marks consistently with real content", () => {
    const query = "Ctrl";
    const { container } = render(
      <StrictMode>
        <HelpMarkdown content={helpContentEn} searchQuery={query} />
      </StrictMode>,
    );

    expect(container.querySelectorAll("mark").length).toBe(
      getSearchMatches(helpContentEn, query).length,
    );
  });
});
