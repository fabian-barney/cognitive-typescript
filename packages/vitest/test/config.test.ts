import { describe, expect, it } from "vitest";

import { CognitiveTypescriptVitestReporter, withCognitiveTypescriptVitest } from "../src/index";

describe("withCognitiveTypescriptVitest", () => {
  it("adds the default reporter and the cognitive reporter when config is empty", () => {
    const config = withCognitiveTypescriptVitest({
      test: {
        include: ["test/**/*.test.ts"]
      }
    });

    expect(config.test?.reporters).toEqual(["default", expect.any(CognitiveTypescriptVitestReporter)]);
  });

  it("preserves configured reporters and prepends the default reporter when missing", () => {
    const config = withCognitiveTypescriptVitest({
      test: {
        reporters: ["summary"]
      }
    });

    expect(config.test?.reporters).toEqual(["default", "summary", expect.any(CognitiveTypescriptVitestReporter)]);
  });

  it("forwards options without mutating coverage settings", () => {
    const options = {
      format: "json" as const,
      junit: false,
      threshold: 9
    };
    const config = withCognitiveTypescriptVitest(
      {
        test: {
          coverage: {
            provider: "v8"
          }
        }
      },
      options
    );

    expect(config.test?.coverage).toEqual({ provider: "v8" });
    const reporters = config.test?.reporters as unknown[];
    const reporter = reporters[1] as CognitiveTypescriptVitestReporter & { options: unknown };
    expect(reporter.options).toEqual(options);
  });
});
