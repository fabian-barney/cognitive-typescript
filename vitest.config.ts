import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Unit tests share one core source instance; packaged consumers verify built exports separately.
    alias: {
      "@barney-media/cognitive-typescript-core": path.resolve("packages/core/src/index.ts")
    }
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      reporter: ["text", "json"],
      reportsDirectory: "coverage"
    },
    include: ["packages/*/test/**/*.test.ts"],
    testTimeout: 120000
  }
});
