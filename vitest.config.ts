import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import os from "node:os";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    reporters: ["verbose"],
    /**
     * Cap the forks pool at 4 workers.
     *
     * Every file is a fresh jsdom + React + recharts boot. Letting vitest fork
     * one worker per core (19 on this 20-core box) saturates the machine: env
     * boot per file stretches to ~5 s and a worker occasionally misses vitest's
     * hard-coded 60 s start window, so `pnpm test` dies with
     * "Failed to start forks worker for …" while every assertion still passes.
     * 4 workers run the same 783 tests in ~43 s instead of ~90 s. `min` keeps
     * 2-core CI runners at 2 workers rather than oversubscribing them.
     */
    maxWorkers: Math.max(1, Math.min(4, os.availableParallelism())),
    /**
     * Pin NODE_ENV for the test run.
     *
     * @testing-library/react calls `React.act`, which only exists in React's
     * *development* build. When the ambient shell already exports
     * `NODE_ENV=production`, React resolves to its production build and every
     * render-based suite dies with `React.act is not a function`. Declaring it
     * here makes `pnpm test` behave identically in every shell and in CI.
     */
    env: {
      NODE_ENV: "test",
    },
  },
});
