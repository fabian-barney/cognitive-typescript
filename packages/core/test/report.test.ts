import { describe, expect, it } from "vitest";

import {
  buildAgentAnalysisReport,
  buildAnalysisReport,
  formatAnalysisReport,
  formatJunitReport,
  formatTextReport,
  formatToonReport,
  sortMetrics
} from "../src/report";
import type { MethodMetrics, SourceExclusionAudit } from "../src/types";

function metric(overrides: Partial<MethodMetrics> = {}): MethodMetrics {
  return {
    functionName: "safe",
    containerName: null,
    displayName: "safe",
    startLine: 1,
    endLine: 3,
    bodySpan: {
      startLine: 1,
      startColumn: 0,
      endLine: 3,
      endColumn: 1
    },
    cognitiveComplexity: 1,
    filePath: "/repo/src/sample.ts",
    relativePath: "src/sample.ts",
    location: "src/sample.ts:1-3",
    ...overrides
  };
}

function audit(overrides: Partial<SourceExclusionAudit> = {}): SourceExclusionAudit {
  return {
    discoveredFiles: 3,
    analyzedFiles: 2,
    analyzedFunctions: 2,
    excludedFiles: 1,
    excludedFunctions: 1,
    excludedFileReasons: [{ reason: "default:path:generated-directory", count: 1 }],
    excludedFunctionReasons: [{ reason: "user:name:.*Factory$", count: 1 }],
    ...overrides
  };
}

describe("report formatting", () => {
  it("builds status and method entries from cognitive metrics", () => {
    const report = buildAnalysisReport([
      metric(),
      metric({
        displayName: "risky",
        startLine: 5,
        endLine: 10,
        cognitiveComplexity: 16
      })
    ]);

    expect(report.status).toBe("failed");
    expect(report.threshold).toBe(15);
    expect(report.methods).toEqual([
      {
        status: "failed",
        cc: 16,
        method: "risky",
        src: "src/sample.ts",
        lineStart: 5,
        lineEnd: 10
      },
      {
        status: "passed",
        cc: 1,
        method: "safe",
        src: "src/sample.ts",
        lineStart: 1,
        lineEnd: 3
      }
    ]);
  });

  it("uses deterministic ordering by complexity, source, method, and line", () => {
    const metrics = sortMetrics([
      metric({ displayName: "b", relativePath: "src/b.ts", startLine: 9, cognitiveComplexity: 4 }),
      metric({ displayName: "a", relativePath: "src/b.ts", startLine: 1, cognitiveComplexity: 4 }),
      metric({ displayName: "z", relativePath: "src/a.ts", startLine: 5, cognitiveComplexity: 4 }),
      metric({ displayName: "top", relativePath: "src/c.ts", startLine: 1, cognitiveComplexity: 9 })
    ]);

    expect(metrics.map((entry) => `${entry.relativePath}:${entry.displayName}:${entry.startLine}`)).toEqual([
      "src/c.ts:top:1",
      "src/a.ts:z:5",
      "src/b.ts:a:1",
      "src/b.ts:b:9"
    ]);
  });

  it("formats JSON, text, and TOON reports with the cognitive-only model", () => {
    const metrics = [metric({ displayName: "risky", cognitiveComplexity: 16 })];

    expect(
      JSON.parse(
        formatAnalysisReport(metrics, {
          format: "json",
          exclusionAudit: audit()
        })
      )
    ).toEqual({
      status: "failed",
      threshold: 15,
      methods: [
        {
          status: "failed",
          cc: 16,
          method: "risky",
          src: "src/sample.ts",
          lineStart: 1,
          lineEnd: 3
        }
      ],
      exclusions: audit()
    });
    expect(formatTextReport(buildAnalysisReport(metrics, 15, false, audit()))).toContain("exclusions:");
    expect(formatToonReport(buildAnalysisReport(metrics, 15, false, audit()))).toContain("exclusions:");
  });

  it("omits TOON exclusion lines when no audit is present", () => {
    expect(formatToonReport(buildAnalysisReport([metric()]))).not.toContain("exclusions:");
  });

  it("filters failures and omits redundant method status for compact primary reports", () => {
    const parsed = JSON.parse(
      formatAnalysisReport([metric(), metric({ displayName: "risky", cognitiveComplexity: 16 })], {
        format: "json",
        failuresOnly: true,
        omitRedundancy: true
      })
    ) as { status: string; threshold: number; methods: Array<Record<string, unknown>> };

    expect(parsed.status).toBe("failed");
    expect(parsed.threshold).toBe(15);
    expect(parsed.methods).toEqual([
      expect.objectContaining({
        method: "risky",
        cc: 16
      })
    ]);
    expect(parsed.methods[0]).not.toHaveProperty("status");
  });

  it("uses agent as failures-only plus omit-redundancy defaults", () => {
    const report = buildAgentAnalysisReport([metric(), metric({ displayName: "risky", cognitiveComplexity: 16 })], 15);
    const parsed = JSON.parse(
      formatAnalysisReport([metric(), metric({ displayName: "risky", cognitiveComplexity: 16 })], {
        format: "json",
        agent: true,
        exclusionAudit: audit(),
        includeExclusionAudit: false
      })
    ) as typeof report;

    expect(parsed).toEqual(report);
    expect(parsed.methods).toHaveLength(1);
    expect(parsed.methods[0]).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("exclusions");
  });

  it("can include exclusion audit in compact reports when explicitly requested", () => {
    expect(buildAgentAnalysisReport([metric({ displayName: "risky", cognitiveComplexity: 16 })], 15, audit())).toEqual({
      status: "failed",
      threshold: 15,
      methods: [
        {
          cc: 16,
          method: "risky",
          src: "src/sample.ts",
          lineStart: 1,
          lineEnd: 3
        }
      ],
      exclusions: audit()
    });
  });

  it("does not add a blank separator before exclusions when there are no methods", () => {
    expect(formatTextReport(buildAnalysisReport([], 15, false, audit()))).toBe(
      "status: passed\n" +
        "threshold: 15\n" +
        "methods[0]:\n" +
        "exclusions:\n" +
        "  discoveredFiles: 3\n" +
        "  analyzedFiles: 2\n" +
        "  analyzedFunctions: 2\n" +
        "  excludedFiles: 1\n" +
        "  excludedFunctions: 1\n" +
        "  file.default:path:generated-directory: 1\n" +
        "  function.user:name:.*Factory$: 1\n"
    );
  });

  it("formats JUnit XML with elapsed time and failure diagnostics", () => {
    const output = formatJunitReport(
      buildAnalysisReport(
        [
          metric({
            displayName: 'risky "quoted" <value>',
            relativePath: "src/quoted&file.ts",
            cognitiveComplexity: 16
          }),
          metric()
        ],
        15,
        false,
        audit()
      ),
      false,
      0.25
    );

    expect(output).toContain(
      '<testsuites name="cognitive-typescript" tests="2" failures="1" skipped="0" errors="0" time="0.250000">'
    );
    expect(output).toContain('classname="src/quoted&amp;file.ts"');
    expect(output).toContain('name="risky &quot;quoted&quot; &lt;value&gt;:1 [CC=16]"');
    expect(output).toContain('name="safe:1 [CC=1]"');
    expect(output).toContain('<property name="status" value="failed"/>');
    expect(output).toContain('<property name="exclusion.discoveredFiles" value="3"/>');
    expect(output).toContain('<property name="exclusion.excludedFunctions" value="1"/>');
    expect(output).toContain("Cognitive Complexity: 16");
    expect(output).toContain("Threshold: 15");
    expect(output).toContain("<system-out>Cognitive Complexity: 16");
    expect(output).toContain("<system-out>Cognitive Complexity: 1");
    expect(output).toContain("Source: src/quoted&amp;file.ts:1-3");
  });

  it("rounds tiny positive JUnit elapsed times up to a visible non-zero value", () => {
    const output = formatJunitReport(buildAnalysisReport([metric()]), false, Number.EPSILON);

    expect(output).toContain('time="0.000001"');
  });

  it("returns empty content for none reports after validating the threshold", () => {
    expect(formatAnalysisReport([metric()], { format: "none" })).toBe("");
    expect(() => formatAnalysisReport([], { format: "none", threshold: 0 })).toThrow(
      "Threshold must be a positive integer"
    );
  });
});
