import { afterEach, describe, expect, it } from "vitest";

import { analyzeProject } from "../src/index";
import { createTempDir, disposeTempDir, writeProjectFiles } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("analyzeProject", () => {
  it("adds recursion penalties across files in the same project", async () => {
    const projectRoot = await createTempDir("cognitive-analysis-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/a.ts": `import { second } from "./b";
export function first(flag: boolean): number {
  if (flag) {
    return second(false);
  }
  return 0;
}
`,
      "src/b.ts": `import { first } from "./a";
export function second(flag: boolean): number {
  if (flag) {
    return first(false);
  }
  return 0;
}
`
    });

    const result = await analyzeProject({ projectRoot });
    expect(Object.fromEntries(result.metrics.map((metric) => [metric.displayName, metric.cognitiveComplexity]))).toEqual({
      first: 2,
      second: 2
    });
    expect(result.maxCognitiveComplexity).toBe(2);
    expect(result.thresholdExceeded).toBe(false);
  });

  it("reports threshold failures when any function exceeds 25", async () => {
    const projectRoot = await createTempDir("cognitive-analysis-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/sample.ts": `${buildDeepNestedIfFunction("tooComplex", 7)}

export function safe(value: number): number {
  return value + 1;
}
`
    });

    const result = await analyzeProject({ projectRoot });
    expect(result.thresholdExceeded).toBe(true);
    expect(result.maxCognitiveComplexity).toBe(28);
    expect(result.metrics.some((metric) => metric.displayName === "tooComplex")).toBe(true);
  });
});

function buildDeepNestedIfFunction(name: string, depth: number): string {
  const parameters = Array.from({ length: depth }, (_value, index) => `flag${index + 1}: boolean`).join(", ");
  const lines = [`export function ${name}(${parameters}): number {`];
  let indent = "  ";
  for (let index = 0; index < depth; index += 1) {
    lines.push(`${indent}if (flag${index + 1}) {`);
    indent += "  ";
  }
  lines.push(`${indent}return 1;`);
  for (let index = depth - 1; index >= 0; index -= 1) {
    indent = indent.slice(0, -2);
    lines.push(`${indent}}`);
  }
  lines.push("  return 0;");
  lines.push("}");
  return lines.join("\n");
}
