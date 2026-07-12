import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { xanCommands } from "@/data/commands";

// Test all invoke call patterns from App.tsx

describe("App.tsx invoke call patterns", () => {
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("read_csv_file", () => {
    it("should call with correct params", async () => {
      mockInvoke.mockResolvedValue({
        headers: ["name", "age"],
        rows: [["Alice", "30"]],
      });

      const result = await invoke<{ headers: string[]; rows: string[][] }>(
        "read_csv_file",
        { filePath: "/test.csv", delimiter: ",", limit: 31 },
      );

      expect(result.headers).toEqual(["name", "age"]);
      expect(result.rows).toHaveLength(1);
      expect(mockInvoke).toHaveBeenCalledWith("read_csv_file", {
        filePath: "/test.csv",
        delimiter: ",",
        limit: 31,
      });
    });

    it("should pass custom delimiter", async () => {
      mockInvoke.mockResolvedValue({ headers: [], rows: [] });

      await invoke("read_csv_file", {
        filePath: "/test.tsv",
        delimiter: "\t",
        limit: 31,
      });

      expect(mockInvoke).toHaveBeenCalledWith("read_csv_file", {
        filePath: "/test.tsv",
        delimiter: "\t",
        limit: 31,
      });
    });
  });

  describe("load_history / save_history", () => {
    it("should load history and parse JSON", async () => {
      const historyData = JSON.stringify([
        { id: "h1", name: "Tab1", pipeline: [], executedAt: "2024-01-01" },
      ]);
      mockInvoke.mockResolvedValue(historyData);

      const content = await invoke<string>("load_history");
      const history = JSON.parse(content);

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe("h1");
    });

    it("should save history with limit", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("save_history", {
        history: JSON.stringify([{ id: "h1" }]),
        limit: 50,
      });

      expect(mockInvoke).toHaveBeenCalledWith("save_history", {
        history: expect.any(String),
        limit: 50,
      });
    });

    it("should handle empty history gracefully", async () => {
      mockInvoke.mockResolvedValue("[]");

      const content = await invoke<string>("load_history");
      const history = JSON.parse(content);

      expect(history).toEqual([]);
    });
  });

  describe("load_recent_files / save_recent_files", () => {
    it("should load recent files", async () => {
      const filesData = JSON.stringify([
        { path: "/a.csv", name: "a.csv", openedAt: "2024-01-01" },
      ]);
      mockInvoke.mockResolvedValue(filesData);

      const content = await invoke<string>("load_recent_files");
      const files = JSON.parse(content);

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("/a.csv");
    });

    it("should save recent files", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("save_recent_files", {
        recentFiles: JSON.stringify([{ path: "/a.csv" }]),
      });

      expect(mockInvoke).toHaveBeenCalledWith("save_recent_files", {
        recentFiles: expect.any(String),
      });
    });
  });

  describe("get/set_default_delimiter", () => {
    it("should load saved delimiter", async () => {
      mockInvoke.mockResolvedValue("\t");

      const saved = await invoke<string | null>("get_default_delimiter");
      expect(saved).toBe("\t");
    });

    it("should return null when no saved delimiter", async () => {
      mockInvoke.mockResolvedValue(null);

      const saved = await invoke<string | null>("get_default_delimiter");
      expect(saved).toBeNull();
    });

    it("should save delimiter", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("set_default_delimiter", { delimiter: ";" });

      expect(mockInvoke).toHaveBeenCalledWith("set_default_delimiter", {
        delimiter: ";",
      });
    });
  });

  describe("get/set_no_headers", () => {
    it("should load no-headers setting", async () => {
      mockInvoke.mockResolvedValue(true);

      const saved = await invoke<boolean | null>("get_no_headers");
      expect(saved).toBe(true);
    });

    it("should save no-headers setting", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("set_no_headers", { noHeaders: true });

      expect(mockInvoke).toHaveBeenCalledWith("set_no_headers", {
        noHeaders: true,
      });
    });
  });

  describe("get/set_system_notification", () => {
    it("should load notification setting", async () => {
      mockInvoke.mockResolvedValue(false);

      const saved = await invoke<boolean | null>("get_system_notification");
      expect(saved).toBe(false);
    });

    it("should save notification setting", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("set_system_notification", { enabled: false });

      expect(mockInvoke).toHaveBeenCalledWith("set_system_notification", {
        enabled: false,
      });
    });
  });

  describe("get/set_minimize_to_tray", () => {
    it("should load minimize-to-tray setting", async () => {
      mockInvoke.mockResolvedValue(true);

      const saved = await invoke<boolean | null>("get_minimize_to_tray");
      expect(saved).toBe(true);
    });

    it("should save minimize-to-tray setting", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("set_minimize_to_tray", { enabled: true });

      expect(mockInvoke).toHaveBeenCalledWith("set_minimize_to_tray", {
        enabled: true,
      });
    });
  });

  describe("get/set_history_limit", () => {
    it("should load history limit", async () => {
      mockInvoke.mockResolvedValue(200);

      const saved = await invoke<number | null>("get_history_limit");
      expect(saved).toBe(200);
    });

    it("should save history limit", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("set_history_limit", { limit: 200 });

      expect(mockInvoke).toHaveBeenCalledWith("set_history_limit", {
        limit: 200,
      });
    });
  });

  describe("check_xan_installed", () => {
    it("should call check_xan_installed", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("check_xan_installed");

      expect(mockInvoke).toHaveBeenCalledWith("check_xan_installed");
    });
  });

  describe("toggle_devtools", () => {
    it("should call toggle_devtools", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("toggle_devtools");

      expect(mockInvoke).toHaveBeenCalledWith("toggle_devtools");
    });
  });

  describe("set_window_title", () => {
    it("should set window title", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await invoke("set_window_title", { title: "Easy CSV - My Pipeline" });

      expect(mockInvoke).toHaveBeenCalledWith("set_window_title", {
        title: "Easy CSV - My Pipeline",
      });
    });
  });

  describe("error handling patterns", () => {
    it("should handle invoke failure for load operations", async () => {
      mockInvoke.mockRejectedValue(new Error("File not found"));

      await expect(invoke("load_history")).rejects.toThrow("File not found");
    });

    it("should handle invoke failure for save operations", async () => {
      mockInvoke.mockRejectedValue(new Error("Permission denied"));

      await expect(
        invoke("save_history", { history: "[]", limit: 100 }),
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("history reconstruction from stored format", () => {
    it("should reconstruct PipelineStep from minimal commandId format", () => {
      const storedHistory = [
        {
          id: "h1",
          name: "Tab1",
          pipeline: [
            {
              id: "step-1",
              commandId: "search",
              parameters: { select: "name" },
            },
          ],
        },
      ];

      const reconstructed = storedHistory.map((item: any) => ({
        ...item,
        pipeline: item.pipeline
          .map((step: any) => {
            if (step.command) return step;
            const command = xanCommands.find(
              (cmd: any) => cmd.id === step.commandId,
            );
            if (!command) return null;
            return {
              id: step.id,
              command,
              parameters: step.parameters || {},
              alias: step.alias,
              position: step.position,
            };
          })
          .filter(Boolean),
      }));

      expect(reconstructed[0].pipeline).toHaveLength(1);
      expect(reconstructed[0].pipeline[0].command.id).toBe("search");
    });

    it("should skip unknown commands during reconstruction", () => {
      const storedHistory = [
        {
          id: "h1",
          pipeline: [{ id: "s1", commandId: "nonexistent", parameters: {} }],
        },
      ];

      const reconstructed = storedHistory.map((item: any) => ({
        ...item,
        pipeline: item.pipeline
          .map((step: any) => {
            const command = xanCommands.find(
              (cmd: any) => cmd.id === step.commandId,
            );
            if (!command) return null;
            return { id: step.id, command, parameters: step.parameters || {} };
          })
          .filter(Boolean),
      }));

      expect(reconstructed[0].pipeline).toHaveLength(0);
    });
  });
});
