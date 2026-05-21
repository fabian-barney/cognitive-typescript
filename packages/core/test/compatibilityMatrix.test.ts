import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeProject } from "../src/index";
import { repoPath } from "./testUtils";

interface MatrixCase {
  name: string;
  fixture: string;
  expectedMetrics: Array<{
    name: string;
    cognitiveComplexity: number;
  }>;
}

const matrix = JSON.parse(
  readFileSync(repoPath("tests", "fixtures", "compatibility-matrix", "matrix.json"), "utf8")
) as { cases: MatrixCase[] };

describe("compatibility matrix", () => {
  for (const testCase of matrix.cases) {
    it(testCase.name, async () => {
      const projectRoot = repoPath("tests", "fixtures", testCase.fixture);
      const result = await analyzeProject({ projectRoot });

      expect(toMetricMap(result.metrics)).toEqual(
        Object.fromEntries(testCase.expectedMetrics.map((metric) => [metric.name, metric.cognitiveComplexity]))
      );
      expect(result.selectedFiles.every((filePath) => path.basename(path.dirname(filePath)) === "src")).toBe(true);
    });
  }
});

function toMetricMap(metrics: Awaited<ReturnType<typeof analyzeProject>>["metrics"]): Record<string, number> {
  return Object.fromEntries(metrics.map((metric) => [metric.displayName, metric.cognitiveComplexity]));
}
