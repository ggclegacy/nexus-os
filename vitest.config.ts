import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: false,
    restoreMocks: true,
    testTimeout: 20_000,
    exclude: ["tests/rendered-html.test.mjs", "node_modules/**", "dist/**"],
  },
});
