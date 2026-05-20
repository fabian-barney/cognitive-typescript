import { describe, expect, it } from "vitest";

import { DEFAULT_JUNIT_REPORT, resolveReporterReportOptions } from "../src/reporterOptions";

describe("resolveReporterReportOptions", () => {
  it("uses the shared default junit report path", () => {
    expect(resolveReporterReportOptions({}).junitReport).toBe(DEFAULT_JUNIT_REPORT);
  });

  it("rejects empty output paths like the CLI", () => {
    expect(() => resolveReporterReportOptions({ output: "" })).toThrow("--output requires a path");
    expect(() => resolveReporterReportOptions({ output: " reports/out.json" })).toThrow(
      "--output must not include leading or trailing whitespace"
    );
  });

  it("rejects empty junit report paths like the CLI", () => {
    expect(() => resolveReporterReportOptions({ junitReport: "" })).toThrow("--junit-report requires a path");
    expect(() => resolveReporterReportOptions({ junitReport: " reports/junit.xml" })).toThrow(
      "--junit-report must not include leading or trailing whitespace"
    );
  });

  it("resolves source exclusion options with the shared defaults", () => {
    expect(resolveReporterReportOptions({
      excludes: ["src/generated/**"],
      excludeNames: [".*Factory$"],
      excludeDecorators: ["Generated"],
      excludeComments: ["@custom-generated"]
    })).toMatchObject({
      excludes: ["src/generated/**"],
      excludeNames: [".*Factory$"],
      excludeDecorators: ["Generated"],
      excludeComments: ["@custom-generated"],
      useDefaultExclusions: true
    });
  });

  it("rejects blank source exclusion values like the CLI", () => {
    expect(() => resolveReporterReportOptions({ excludes: [""] })).toThrow("--exclude requires a value");
    expect(() => resolveReporterReportOptions({ excludeNames: [" .*Factory$"] })).toThrow(
      "--exclude-name must not include leading or trailing whitespace"
    );
  });
});
