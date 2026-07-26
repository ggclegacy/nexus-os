import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: false,
    restoreMocks: true,
    testTimeout: 30_000,
    fileParallelism: false,
    exclude: ["tests/rendered-html.test.mjs", "node_modules/**", "dist/**"],
  },
});
