import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure-logic unit tests only — no DOM, no DB.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
