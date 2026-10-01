import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
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
