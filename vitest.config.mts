import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Database test files each start an in-process Postgres (PGlite). Two running
    // at once crash the worker on Windows, so files run one after another.
    fileParallelism: false,
  },
});
