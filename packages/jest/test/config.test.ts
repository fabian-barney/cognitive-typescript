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
});
