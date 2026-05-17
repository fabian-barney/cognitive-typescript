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
import type { MethodMetrics } from "../src/types";

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

    expect(JSON.parse(formatAnalysisReport(metrics, { format: "json" }))).toEqual({
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
      ]
    });
    expect(formatTextReport(buildAnalysisReport(metrics))).toContain("| status | cc | method | src");
    expect(formatToonReport(buildAnalysisReport(metrics))).toContain("methods[1]{status,cc,method,src,lineStart,lineEnd}:");
  });

  it("filters failures and omits redundant method status for compact primary reports", () => {
    const parsed = JSON.parse(formatAnalysisReport([
      metric(),
      metric({ displayName: "risky", cognitiveComplexity: 16 })
    ], {
      format: "json",
      failuresOnly: true,
      omitRedundancy: true
    })) as { status: string; threshold: number; methods: Array<Record<string, unknown>> };

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
    const report = buildAgentAnalysisReport([
      metric(),
      metric({ displayName: "risky", cognitiveComplexity: 16 })
    ]);
    const parsed = JSON.parse(formatAnalysisReport([
      metric(),
      metric({ displayName: "risky", cognitiveComplexity: 16 })
    ], {
      format: "json",
      agent: true
    })) as typeof report;

    expect(parsed).toEqual(report);
    expect(parsed.methods).toHaveLength(1);
    expect(parsed.methods[0]).not.toHaveProperty("status");
  });

  it("formats JUnit XML with elapsed time and failure diagnostics", () => {
    const output = formatJunitReport(buildAnalysisReport([
      metric({ displayName: "risky \"quoted\" <value>", relativePath: "src/quoted&file.ts", cognitiveComplexity: 16 })
    ]), false, 0.25);

    expect(output).toContain('<testsuites name="cognitive-typescript" tests="1" failures="1" skipped="0" errors="0" time="0.250000">');
    expect(output).toContain('classname="src/quoted&amp;file.ts"');
    expect(output).toContain('name="risky &quot;quoted&quot; &lt;value&gt;:1"');
    expect(output).toContain('<property name="status" value="failed"/>');
    expect(output).toContain("Cognitive Complexity: 16");
    expect(output).toContain("Threshold: 15");
    expect(output).toContain("Source: src/quoted&amp;file.ts:1-3");
  });

  it("returns empty content for none reports after validating the threshold", () => {
    expect(formatAnalysisReport([metric()], { format: "none" })).toBe("");
    expect(() => formatAnalysisReport([], { format: "none", threshold: 0 })).toThrow(
      "Threshold must be a positive integer"
    );
  });
});
