/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
    css: true,
    coverage: {
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "tests/reports/coverage/ui",
      exclude: ["**/node_modules/**", "**/dist/**"],
    },
  },
});
