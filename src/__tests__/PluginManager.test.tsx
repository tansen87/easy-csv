import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ComponentProps } from "react";
import { LanguageProvider } from "@/i18n";
import { invoke } from "@tauri-apps/api/core";
import { PluginManager } from "@/modules/plugins";
import type { CatalogEntry, CatalogView } from "@/services/plugins";

// `open` comes from the shell plugin; the row uses it for the homepage link.
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));

/**
 * The progress listener is captured rather than stubbed away: several tests need
 * to push an event into the component, which is the only way to exercise the
 * per-plugin routing.
 *
 * The captured function takes the *event object* Tauri delivers, because the
 * service layer unwraps `event.payload` itself — mocking it as if it received
 * the payload directly would test a shape that never occurs.
 */
type ProgressPayload = {
  name: string;
  phase: "downloading" | "verifying" | "done" | "cancelled" | "failed";
  downloaded: number;
  total: number;
};
type ProgressHandler = (event: { payload: ProgressPayload }) => void;
let progressHandlers: ProgressHandler[] = [];

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_event: string, handler: ProgressHandler) => {
    progressHandlers.push(handler);
    return () => {
      progressHandlers = progressHandlers.filter((h) => h !== handler);
    };
  }),
}));

// `@tauri-apps/api/core` is already mocked globally in `src/test/setup.ts`.
// Re-mocking it here would create a *second* module instance that the service
// layer never imports, so the assertions would pass against a mock nobody
// calls. Taking the shared one is what makes these tests meaningful.
const mockInvoke = vi.mocked(invoke);

/** The shape the Rust `CatalogEntry` actually serialises to (snake_case). */
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

function view(entries: CatalogEntry[]): CatalogView {
  return {
    fetched_at: 1_800_000_000,
    stale: false,
    plugin_dir: "/app/plugins/windows-x86_64",
    platform: "windows-x86_64",
    entries,
  };
}

/**
 * Routes `invoke` by command name. `install_plugin` resolves with a status, so
 * the default here must not be a bare `undefined` — the hook applies it.
 */
function routeInvoke(
  catalog: CatalogView,
  overrides: Record<string, unknown> = {},
) {
  mockInvoke.mockImplementation((async (command: string) => {
    if (command in overrides) {
      const value = overrides[command];
      if (value instanceof Error) throw value;
      return value;
    }
    switch (command) {
      case "get_plugin_catalog":
        return catalog;
      case "check_plugins":
        return catalog.entries.map((e) => ({
          name: e.name,
          executable: e.name,
          found: e.installed,
          version: e.installed_version ?? "",
        }));
      case "install_plugin":
        return {
          name: "xan",
          executable: "xan",
          found: true,
          version: "0.61.0",
        };
      case "uninstall_plugin":
        return undefined;
      case "reveal_paths":
        return undefined;
      // The download-prefix field reads its current value on mount. Default to
      // "unset" so a test that does not care sees what a fresh install sees.
      case "get_plugin_download_prefix":
        return null;
      default:
        return undefined;
    }
  }) as unknown as typeof invoke);
}

function renderManager(
  overrides: Partial<ComponentProps<typeof PluginManager>> = {},
) {
  const showToast = vi.fn();
  const view2 = render(
    <LanguageProvider>
      <PluginManager showToast={showToast} {...overrides} />
    </LanguageProvider>,
  );
  return { ...view2, showToast };
}

/**
 * Pushes a progress event into every subscribed handler.
 *
 * Wrapped in `act` because the event arrives from outside React — without it
 * the state update is not flushed and the assertions run against the old tree.
 */
async function emitProgress(payload: ProgressPayload) {
  await act(async () => {
    for (const handler of progressHandlers) handler({ payload });
  });
}

beforeEach(() => {
  progressHandlers = [];
  // `clearAllMocks` does not reset implementations; an implementation left over
  // from another test would leak into this one.
  mockInvoke.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  progressHandlers = [];
});

describe("PluginManager catalog rendering", () => {
  it("offers Download for a plugin the catalog has and the machine lacks", async () => {
    routeInvoke(view([entry()]));
    renderManager();

    const button = await screen.findByRole("button", { name: /Download/ });
    expect(button).toBeEnabled();
    // Nothing is installed, so nothing may be offered for removal.
    expect(
      screen.queryByRole("button", { name: /Uninstall/ }),
    ).not.toBeInTheDocument();
  });

  it("offers Update only where the backend said an update exists", async () => {
    // Two installed plugins, only one of which the backend flagged. This is the
    // whole point of `update_available`: a hand-placed binary is never upgraded
    // behind the user's back.
    routeInvoke(
      view([
        entry({
          name: "xan",
          title: "xan",
          installed: true,
          installed_version: "0.60.0",
          installed_path: "/app/plugins/windows-x86_64/xan.exe",
          source: "registry",
          update_available: true,
        }),
        entry({
          name: "pinyin",
          title: "pinyin",
          installed: true,
          installed_version: "0.1.0",
          installed_path: "/app/plugins/windows-x86_64/pinyin.exe",
          source: "manual",
          update_available: false,
        }),
      ]),
    );
    renderManager();

    await screen.findByText("pinyin");
    expect(screen.getAllByRole("button", { name: /Update/ })).toHaveLength(1);
  });

  it("only offers Uninstall for a binary this app installed", async () => {
    // `uninstall_plugin` refuses anything outside the plugin directory, so the
    // button must not appear for a PATH or hand-placed binary.
    routeInvoke(
      view([
        entry({
          name: "xan",
          title: "xan",
          installed: true,
          installed_path: "/usr/local/bin/xan",
          source: "path",
        }),
        entry({
          name: "duckdb",
          title: "duckdb",
          installed: true,
          installed_version: "1.5.5",
          installed_path: "/app/plugins/windows-x86_64/duckdb.exe",
          source: "registry",
        }),
      ]),
    );
    renderManager();

    await screen.findByText("duckdb");
    const remove = screen.getAllByRole("button", { name: /Uninstall/ });
    expect(remove).toHaveLength(1);

    // The one on offer must be duckdb's, not xan's.
    fireEvent.click(remove[0]);
    expect(
      await screen.findByText(/duckdb\.exe/),
    ).toBeInTheDocument();
  });

  it("says the catalog is cached instead of pretending an offline fetch worked", async () => {
    // `stale` is the backend's own flag: it only sets it when a live fetch
    // failed and the list came from disk. Showing it silently would let the user
    // act on version numbers that may be days old.
    routeInvoke({ ...view([entry()]), stale: true });
    renderManager();

    expect(await screen.findByText(/cached catalog/i)).toBeInTheDocument();
  });

  it("does not warn about caching when the catalog is current", async () => {
    routeInvoke(view([entry()]));
    renderManager();

    await screen.findByText("xan");
    expect(screen.queryByText(/cached catalog/i)).not.toBeInTheDocument();
  });

  it("keeps a catalog failure as a banner rather than blanking the list", async () => {
    routeInvoke(view([]), {
      get_plugin_catalog: new Error("HTTP 404"),
    });
    renderManager();

    expect(await screen.findByText(/Failed to load the plugin catalog/)).toBeInTheDocument();
    expect(screen.getByText("HTTP 404")).toBeInTheDocument();
    // The retry path must be reachable, otherwise a transient failure is fatal.
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });
});

describe("PluginManager installs", () => {
  it("routes progress to the plugin the event names", async () => {
    routeInvoke(
      view([
        entry({ name: "xan", title: "xan" }),
        entry({ name: "duckdb", title: "duckdb" }),
      ]),
    );
    renderManager();

    await screen.findByText("duckdb");
    // `listen` is async, so the subscription may not exist yet.
    await waitFor(() => expect(progressHandlers.length).toBeGreaterThan(0));

    // 10 of 40 MiB → a stable 25% that can only belong to duckdb.
    await emitProgress({
      name: "duckdb",
      phase: "downloading",
      downloaded: 10 * 1024 * 1024,
      total: 40 * 1024 * 1024,
    });

    expect(await screen.findByText(/25%/)).toBeInTheDocument();
    // Exactly one row may show it.
    expect(screen.getAllByText(/25%/)).toHaveLength(1);
  });

  it("shows verification as its own phase", async () => {
    routeInvoke(view([entry()]));
    renderManager();
    await screen.findByText("xan");
    await waitFor(() => expect(progressHandlers.length).toBeGreaterThan(0));

    await emitProgress({
      name: "xan",
      phase: "verifying",
      downloaded: 100,
      total: 100,
    });

    expect(await screen.findByText(/Verifying/)).toBeInTheDocument();
  });

  it("calls install_plugin with the plugin name and reports success", async () => {
    routeInvoke(view([entry()]));
    const { showToast } = renderManager();

    fireEvent.click(await screen.findByRole("button", { name: /Download/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("install_plugin", {
        name: "xan",
      }),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("xan installed"),
        "success",
      ),
    );
  });

  it("surfaces a failed install without clearing the list", async () => {
    routeInvoke(view([entry()]), {
      install_plugin: new Error("checksum mismatch"),
    });
    const { showToast } = renderManager();

    fireEvent.click(await screen.findByRole("button", { name: /Download/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("checksum mismatch"),
        "error",
      ),
    );
    // The row is still there and still installable — a failure is not fatal.
    expect(await screen.findByText("xan")).toBeInTheDocument();
  });
});

describe("PluginManager uninstall", () => {
  it("confirms before deleting and shows the path", async () => {
    routeInvoke(
      view([
        entry({
          installed: true,
          installed_version: "0.61.0",
          installed_path: "/app/plugins/windows-x86_64/xan.exe",
          source: "registry",
        }),
      ]),
    );
    renderManager();

    fireEvent.click(
      await screen.findByRole("button", { name: /Uninstall/ }),
    );

    // The dialog names the exact file, so the user knows what is going away.
    expect(await screen.findByText(/Uninstall this plugin\?/)).toBeInTheDocument();
    expect(
      screen.getByText("/app/plugins/windows-x86_64/xan.exe"),
    ).toBeInTheDocument();
    // Nothing has been deleted yet.
    expect(mockInvoke).not.toHaveBeenCalledWith("uninstall_plugin", {
      name: "xan",
    });
  });

  it("deletes only after the confirmation is accepted", async () => {
    routeInvoke(
      view([
        entry({
          installed: true,
          installed_path: "/app/plugins/windows-x86_64/xan.exe",
          source: "registry",
        }),
      ]),
    );
    const { showToast } = renderManager();

    fireEvent.click(await screen.findByRole("button", { name: /Uninstall/ }));
    await screen.findByText(/Uninstall this plugin\?/);

    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("uninstall_plugin", {
        name: "xan",
      }),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("xan removed"),
        "success",
      ),
    );
  });

  it("does nothing when the confirmation is dismissed", async () => {
    routeInvoke(
      view([
        entry({
          installed: true,
          installed_path: "/app/plugins/windows-x86_64/xan.exe",
          source: "registry",
        }),
      ]),
    );
    renderManager();

    fireEvent.click(await screen.findByRole("button", { name: /Uninstall/ }));
    await screen.findByText(/Uninstall this plugin\?/);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));

    await waitFor(() =>
      expect(
        screen.queryByText(/Uninstall this plugin\?/),
      ).not.toBeInTheDocument(),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith("uninstall_plugin", {
      name: "xan",
    });
  });

  it("reports a refused uninstall with the backend's reason", async () => {
    routeInvoke(
      view([
        entry({
          installed: true,
          installed_path: "/app/plugins/windows-x86_64/xan.exe",
          source: "registry",
        }),
      ]),
      { uninstall_plugin: new Error("xan was not installed by Easy CSV") },
    );
    const { showToast } = renderManager();

    fireEvent.click(await screen.findByRole("button", { name: /Uninstall/ }));
    await screen.findByText(/Uninstall this plugin\?/);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("not installed by Easy CSV"),
        "error",
      ),
    );
  });
});

describe("PluginManager refresh", () => {
  it("forces a network round trip only when refresh is pressed", async () => {
    routeInvoke(view([entry()]));
    renderManager();

    // The first load happens against the cache; nothing should have asked for
    // a refresh on its own.
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("get_plugin_catalog", {
        refresh: false,
      }),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith("get_plugin_catalog", {
      refresh: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /Refresh catalog/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("get_plugin_catalog", {
        refresh: true,
      }),
    );
  });

  it("opens the plugin directory through reveal_paths", async () => {
    routeInvoke(view([entry()]));
    renderManager();
    await screen.findByText("xan");

    fireEvent.click(screen.getByRole("button", { name: /Open plugin folder/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("reveal_paths", {
        paths: ["/app/plugins/windows-x86_64"],
      }),
    );
  });

  it("disables the folder button while the reveal is in flight", async () => {
    // A first launch has to create the plugin directory before the OS can open
    // it, so `reveal_paths` can take a moment. The button must not stay
    // clickable during that window.
    let resolveReveal: (() => void) | undefined;
    routeInvoke(view([entry()]), {
      reveal_paths: new Promise<void>((resolve) => {
        resolveReveal = resolve;
      }),
    });
    renderManager();
    await screen.findByText("xan");

    const button = screen.getByRole("button", { name: /Open plugin folder/ });
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());

    // A second click during the wait must not queue another reveal.
    fireEvent.click(button);
    expect(
      mockInvoke.mock.calls.filter(([cmd]) => cmd === "reveal_paths"),
    ).toHaveLength(1);

    resolveReveal?.();
    await waitFor(() => expect(button).toBeEnabled());
  });
});

describe("PluginManager cancellation", () => {
  /** Installs xan and leaves a download in flight. */
  async function startDownload() {
    // `install_plugin` never settles, so the row stays in its downloading state
    // for the test to act on — this is what the real UI looks like while bytes
    // are arriving.
    routeInvoke(view([entry()]), {
      install_plugin: new Promise(() => {}),
      cancel_plugin_install: true,
    });
    const rendered = renderManager();
    fireEvent.click(await screen.findByRole("button", { name: /Download/ }));
    await screen.findByRole("button", { name: /Cancel/ });
    return rendered;
  }

  it("offers Cancel only while a download is running", async () => {
    routeInvoke(view([entry()]));
    renderManager();

    // Before any install: no progress, so nothing to cancel.
    await screen.findByText("xan");
    expect(screen.queryByRole("button", { name: /Cancel/ })).not.toBeInTheDocument();
  });

  it("asks the backend to stop, naming the plugin", async () => {
    await startDownload();

    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("cancel_plugin_install", {
        name: "xan",
      }),
    );
  });

  it("says so when there was nothing left to cancel", async () => {
    // The UI races with the last chunk: by the time cancel arrives the file may
    // already be verifying. A silent no-op would look like a broken button.
    routeInvoke(view([entry()]), {
      install_plugin: new Promise(() => {}),
      cancel_plugin_install: false,
    });
    const { showToast } = renderManager();
    fireEvent.click(await screen.findByRole("button", { name: /Download/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Cancel/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("already finished"),
        "info",
      ),
    );
  });

  it("shows the cancelling state instead of leaving the button live", async () => {
    await startDownload();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));

    // The label changes while the download unwinds, which is the only feedback
    // the user gets between pressing the button and the row settling.
    expect(await screen.findByText(/Cancelling/)).toBeInTheDocument();
  });

  it("reports a cancellation as information, not as a failure", async () => {
    // The backend rejects with the sentinel, which must not paint the error
    // banner or a red toast — the user asked for this.
    routeInvoke(view([entry()]), {
      install_plugin: new Error("cancelled"),
    });
    const { showToast } = renderManager();
    fireEvent.click(await screen.findByRole("button", { name: /Download/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("cancelled"),
        "info",
      ),
    );
    // The catalog banner is for real failures; a deliberate cancellation is not.
    expect(
      screen.queryByText(/Failed to load the plugin catalog/),
    ).not.toBeInTheDocument();
  });

  it("still reports a real failure as an error after a cancellation exists", async () => {
    // Guards the sentinel comparison: anything that is not exactly "cancelled"
    // must keep the loud path.
    routeInvoke(view([entry()]), {
      install_plugin: new Error("checksum mismatch"),
    });
    const { showToast } = renderManager();
    fireEvent.click(await screen.findByRole("button", { name: /Download/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("checksum mismatch"),
        "error",
      ),
    );
  });
});

describe("PluginManager download prefix", () => {
  it("loads the stored prefix into the field", async () => {
    routeInvoke(view([entry()]), {
      get_plugin_download_prefix: "https://ghproxy.example/",
    });
    renderManager();

    await waitFor(() =>
      expect(screen.getByDisplayValue("https://ghproxy.example/")).toBeInTheDocument(),
    );
  });

  it("saves an edited prefix and confirms it", async () => {
    // The component re-reads the stored value after saving — the backend
    // normalizes it (a trailing slash is added), so the field must show what was
    // actually persisted rather than what was typed. The mock therefore has to
    // answer the read-back, or this would look like a "cleared" round trip.
    let stored: string | null = null;
    routeInvoke(view([entry()]), {
      set_plugin_download_prefix: undefined,
    });
    mockInvoke.mockImplementation((async (command: string, args?: unknown) => {
      switch (command) {
        case "get_plugin_catalog":
          return view([entry()]);
        case "check_plugins":
          return [];
        case "set_plugin_download_prefix":
          stored = (args as { prefix: string | null }).prefix;
          return undefined;
        case "get_plugin_download_prefix":
          return stored;
        default:
          return undefined;
      }
    }) as unknown as typeof invoke);
    const { showToast } = renderManager();
    const field = await screen.findByPlaceholderText(/ghproxy/);

    fireEvent.change(field, { target: { value: "https://proxy.example/" } });
    // Save is disabled until something actually changed.
    const save = screen.getByRole("button", { name: /^Save$/ });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("set_plugin_download_prefix", {
        prefix: "https://proxy.example/",
      }),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("saved"),
        "success",
      ),
    );
  });

  it("keeps Save disabled when the field still matches what is stored", async () => {
    routeInvoke(view([entry()]), {
      get_plugin_download_prefix: "https://ghproxy.example/",
    });
    renderManager();

    await screen.findByDisplayValue("https://ghproxy.example/");
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeDisabled();
  });

  it("clears the prefix by sending null, not an empty string", async () => {
    // `None` and "" are the same thing to the backend, but sending null keeps
    // the intent explicit across the IPC boundary.
    routeInvoke(view([entry()]), {
      get_plugin_download_prefix: "https://ghproxy.example/",
    });
    renderManager();
    await screen.findByDisplayValue("https://ghproxy.example/");

    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("set_plugin_download_prefix", {
        prefix: null,
      }),
    );
  });

  it("surfaces the backend's rejection of a bad prefix", async () => {
    // The validation lives in Rust; the field must relay its explanation rather
    // than silently keeping a value that will never be used.
    routeInvoke(view([entry()]), {
      set_plugin_download_prefix: new Error("only https:// prefixes are allowed"),
    });
    const { showToast } = renderManager();
    const field = await screen.findByPlaceholderText(/ghproxy/);

    fireEvent.change(field, { target: { value: "http://proxy.example/" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("only https"),
        "error",
      ),
    );
  });
});
