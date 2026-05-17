import { describe, expect, it } from "vitest";

import { withCognitiveTypescriptJest } from "../src/index";

describe("withCognitiveTypescriptJest", () => {
  it("adds the default reporter and the cognitive reporter entry when config is empty", () => {
    const config = withCognitiveTypescriptJest();

    expect(config.reporters).toEqual([
      "default",
      [expect.any(String), {}]
    ]);
  });

  it("preserves existing reporters and appends the cognitive reporter", () => {
    const config = withCognitiveTypescriptJest({
      reporters: ["default", "summary"]
    });

    expect(config.reporters).toEqual([
      "default",
      "summary",
      [expect.any(String), {}]
    ]);
  });

  it("forwards configured reporter options without mutating coverage settings", () => {
    const options = {
      format: "json" as const,
      junit: false,
      threshold: 9
    };
    const config = withCognitiveTypescriptJest(
      {
        collectCoverage: true,
        coverageDirectory: "coverage"
      },
      options
    );

    expect(config.collectCoverage).toBe(true);
    expect(config.coverageDirectory).toBe("coverage");
    expect(config.reporters).toEqual([
      "default",
      [expect.any(String), options]
    ]);
  });
});
