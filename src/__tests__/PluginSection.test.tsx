import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { LanguageProvider } from "@/i18n";
import { invoke } from "@tauri-apps/api/core";
import { PluginSection } from "@/components/setting/PluginSection";
import { sectionElementId } from "@/components/setting/settingsSections";
import type { CatalogEntry, CatalogView } from "@/services/plugins";

/**
 * The plugin group (design 030 §4.1 / §11.12): the heading carries the summary
 * (`count · open folder · fetch latest`) and every catalogue entry is an ordinary
 * settings row. This suite is what guards "nothing became unreachable" — the
 * catalogue list is gone, so the row actions are the only way in.
 */

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

// `@tauri-apps/api/core` is mocked globally in `src/test/setup.ts`; take that
// same instance so the assertions are against the module the code imports.
const mockInvoke = vi.mocked(invoke);

const PLUGIN_DIR = "/app/plugins/windows-x86_64";

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    name: "xan",
    title: "xan",
    description: "CSV processing engine",
    homepage: "https://github.com/medialab/xan",
    license: "MIT",
    required: true,
    latest_version: "0.61.0",
    available: true,
    size: 18 * 1024 * 1024,
    installed: false,
    installed_version: null,
    installed_path: null,
    source: null,
    update_available: false,
    ...overrides,
  };
}

function catalog(entries: CatalogEntry[]): CatalogView {
  return {
    fetched_at: 1_800_000_000,
    stale: false,
    plugin_dir: PLUGIN_DIR,
    platform: "windows-x86_64",
    entries,
  };
}

function renderSection(overrides: Record<string, unknown> = {}) {
  const showToast = vi.fn();
  const utils = render(
    <LanguageProvider>
      <PluginSection
        sectionId={sectionElementId("plugins")}
        name="Plugins"
        showToast={showToast}
        {...overrides}
      />
    </LanguageProvider>,
  );
  return { ...utils, showToast };
}

function routeInvoke(view: CatalogView, extra: Record<string, unknown> = {}) {
  mockInvoke.mockImplementation((async (command: string) => {
    if (command in extra) return extra[command];
    switch (command) {
      case "get_plugin_catalog":
        return view;
      case "check_plugins":
        return view.entries.map((e) => ({
          name: e.name,
          executable: e.name,
          found: e.installed,
          version: e.installed_version ?? "",
        }));
      default:
        return undefined;
    }
  }) as unknown as typeof invoke);
}

const rowOf = (container: HTMLElement, name: string) =>
  container.querySelector(
    `[data-settings-row="plugin-${name}"]`,
  ) as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PluginSection heading (design 030 §4.1)", () => {
  it("shows how many of the catalogue's plugins are installed", async () => {
    routeInvoke(
      catalog([
        entry({ name: "xan", installed: true, installed_version: "0.61.0" }),
        entry({ name: "duckdb", installed: true, installed_version: "1.1.3" }),
        entry({ name: "other" }),
      ]),
    );
    renderSection();

    expect(await screen.findByText("2/3")).toBeTruthy();
  });

  it("opens the plugin folder", async () => {
    routeInvoke(catalog([entry({ installed: true })]));
    renderSection();

    fireEvent.click(
      await screen.findByRole("button", { name: "Open plugin folder" }),
    );

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("reveal_paths", {
        paths: [PLUGIN_DIR],
      }),
    );
  });

  it("forces a manifest round trip when the latest version is fetched", async () => {
    routeInvoke(catalog([entry()]));
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Refresh catalog" }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("get_plugin_catalog", {
        refresh: true,
      }),
    );
  });
});

describe("PluginSection rows (design 030 §11.12)", () => {
  it("renders one settings row per catalogue entry, with its status", async () => {
    routeInvoke(
      catalog([
        entry({
          name: "xan",
          installed: true,
          installed_version: "0.61.0",
          source: "registry",
        }),
        entry({ name: "duckdb", title: "duckdb" }),
      ]),
    );
    const { container } = renderSection();

    await waitFor(() => expect(rowOf(container, "xan")).toBeTruthy());
    expect(rowOf(container, "xan").textContent).toContain("Installed");
    expect(rowOf(container, "xan").textContent).toContain("v0.61.0");
    expect(rowOf(container, "duckdb").textContent).toContain("Not installed");
    // And the prefix setting is reachable too — it used to live inside the
    // embedded panel that no longer renders anywhere.
    expect(
      container.querySelector('[data-settings-row="plugin-download-prefix"]'),
    ).toBeTruthy();
  });

  it("installs a missing plugin from its row", async () => {
    routeInvoke(catalog([entry({ name: "duckdb", title: "duckdb" })]));
    const { container } = renderSection();

    await waitFor(() => expect(rowOf(container, "duckdb")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("install_plugin", {
        name: "duckdb",
      }),
    );
  });

  it("offers an update only when the backend says there is one", async () => {
    routeInvoke(
      catalog([
        entry({
          name: "xan",
          installed: true,
          installed_version: "0.60.0",
          source: "registry",
          update_available: true,
        }),
      ]),
    );
    renderSection();

    expect(await screen.findByText("Update")).toBeTruthy();
    expect(screen.getByText(/Update available/)).toBeTruthy();
  });

  it("offers uninstall only for a binary this app installed itself", async () => {
    routeInvoke(
      catalog([
        entry({
          name: "xan",
          installed: true,
          installed_version: "0.61.0",
          source: "registry",
          installed_path: "/app/plugins/xan.exe",
        }),
        // A PATH or hand-dropped binary: `uninstall_plugin` refuses these, so the
        // button must not be offered at all.
        entry({
          name: "manual",
          title: "manual",
          installed: true,
          source: "path",
          installed_path: "/usr/local/bin/manual",
        }),
      ]),
    );
    const { container } = renderSection();

    await waitFor(() => expect(rowOf(container, "manual")).toBeTruthy());
    expect(
      rowOf(container, "xan").querySelector('button[aria-label^="Uninstall"]'),
    ).toBeTruthy();
    expect(
      rowOf(container, "manual").querySelector('button[aria-label^="Uninstall"]'),
    ).toBeNull();
  });
});
