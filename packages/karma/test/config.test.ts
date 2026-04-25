import { describe, expect, it } from "vitest";

import { KARMA_REPORTER_NAME, withCognitiveTypescriptKarma } from "../src/index";

describe("withCognitiveTypescriptKarma", () => {
  it("adds the progress reporter, cognitive reporter, plugin, and options when config is empty", () => {
    const config = withCognitiveTypescriptKarma({}, {
      changedOnly: true
    });

    expect(config.reporters).toEqual(["progress", KARMA_REPORTER_NAME]);
    expect(config.plugins).toEqual([
      expect.objectContaining({
        [`reporter:${KARMA_REPORTER_NAME}`]: expect.any(Array)
      })
    ]);
    expect(config.cognitiveTypescript).toEqual({
      changedOnly: true
    });
  });

  it("preserves existing reporters and prepends the progress reporter when missing", () => {
    const config = withCognitiveTypescriptKarma({
      reporters: ["kjhtml"]
    });

    expect(config.reporters).toEqual(["progress", "kjhtml", KARMA_REPORTER_NAME]);
  });

  it("does not duplicate an already registered cognitive plugin", () => {
    const existingPlugin = {
      [`reporter:${KARMA_REPORTER_NAME}`]: ["type", function ExistingReporter() {}]
    };
    const config = withCognitiveTypescriptKarma({
      plugins: [existingPlugin]
    });

    expect(config.plugins).toEqual([existingPlugin]);
  });
});
