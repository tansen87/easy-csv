import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

import { LanguageProvider } from "@/i18n";
import { SettingsNav } from "@/components/setting/SettingsNav";

/**
 * The directory (design 030 §4.4): one entry per group, the current one marked,
 * unmatched groups dimmed rather than hidden while searching.
 */

const groups = [
  { id: "data", name: "Data" },
  { id: "window", name: "Window" },
  { id: "plugins", name: "Plugins" },
];

function renderNav(overrides: Partial<React.ComponentProps<typeof SettingsNav>> = {}) {
  const onNavigate = vi.fn();
  const utils = render(
    <LanguageProvider>
      <SettingsNav
        groups={groups}
        activeId="window"
        dimmedIds={new Set<string>()}
        onNavigate={onNavigate}
        {...overrides}
      />
    </LanguageProvider>,
  );
  return { ...utils, onNavigate };
}

const navButtons = () => screen.getAllByRole("button");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsNav", () => {
  it("lists one entry per group", () => {
    renderNav();

    expect(navButtons().map((button) => button.textContent)).toEqual([
      "Data",
      "Window",
      "Plugins",
    ]);
  });

  it("marks only the current group with aria-current", () => {
    renderNav();

    const current = navButtons().filter(
      (button) => button.getAttribute("aria-current") === "true",
    );
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe("Window");
  });

  it("reports the group that was clicked", () => {
    const { onNavigate } = renderNav();

    fireEvent.click(screen.getByText("Plugins"));

    expect(onNavigate).toHaveBeenCalledWith("plugins");
  });

  it("dims — but keeps — groups with no search match", () => {
    renderNav({ dimmedIds: new Set(["data", "plugins"]) });

    // The dim class sits on the button, not on the inner label span.
    const data = screen.getByRole("button", { name: "Data" });
    const windowGroup = screen.getByRole("button", { name: "Window" });
    expect(navButtons()).toHaveLength(3);
    expect(data.className).toContain("text-muted-foreground/40");
    expect(windowGroup.className).not.toContain("text-muted-foreground/40");
  });

  it("moves focus with the arrow keys", () => {
    renderNav();

    navButtons()[0].focus();
    fireEvent.keyDown(navButtons()[0], { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("Window");

    fireEvent.keyDown(navButtons()[1], { key: "ArrowUp" });
    expect(document.activeElement?.textContent).toBe("Data");

    fireEvent.keyDown(navButtons()[0], { key: "End" });
    expect(document.activeElement?.textContent).toBe("Plugins");

    fireEvent.keyDown(navButtons()[2], { key: "Home" });
    expect(document.activeElement?.textContent).toBe("Data");
  });
});
