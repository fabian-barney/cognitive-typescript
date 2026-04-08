import { describe, expect, it } from "vitest";

import { CognitiveTypescriptVitestReporter, withCognitiveTypescriptVitest } from "../src/index";

describe("withCognitiveTypescriptVitest", () => {
  it("adds the default reporter and the cognitive reporter when config is empty", () => {
    const config = withCognitiveTypescriptVitest({
      test: {
        include: ["test/**/*.test.ts"]
      }
    });

    expect(config.test?.reporters).toEqual([
      "default",
      expect.any(CognitiveTypescriptVitestReporter)
    ]);
  });

  it("preserves configured reporters and prepends the default reporter when missing", () => {
    const config = withCognitiveTypescriptVitest({
      test: {
        reporters: ["summary"]
      }
    });

    expect(config.test?.reporters).toEqual([
      "default",
      "summary",
      expect.any(CognitiveTypescriptVitestReporter)
    ]);
  });
});
