import { afterEach, describe, expect, it } from "vitest";

import { analyzeProject } from "../src/index";
import { createTempDir, disposeTempDir, writeProjectFiles } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("source exclusions", () => {
  it("excludes generated files by default and records audit counts", async () => {
    const projectRoot = await createTempDir("cognitive-exclusions-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/generated/sample.generated.ts": buildDeepNestedIfFunction("tooComplex", 7),
      "src/manual.ts": buildSimpleFunction("safe")
    });

    const result = await analyzeProject({ projectRoot });

    expect(result.thresholdExceeded).toBe(false);
    expect(result.metrics.map((metric) => metric.displayName)).toEqual(["safe"]);
    expect(result.exclusionAudit).toMatchObject({
      discoveredFiles: 2,
      analyzedFiles: 1,
      analyzedFunctions: 1,
      excludedFiles: 1,
      excludedFunctions: 0
    });
    expect(result.exclusionAudit.excludedFileReasons).toContainEqual({
      reason: "default:path:generated-file",
      count: 1
    });
  });

  it("disables default exclusions when requested", async () => {
    const projectRoot = await createTempDir("cognitive-exclusions-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/generated/sample.generated.ts": buildDeepNestedIfFunction("tooComplex", 7)
    });

    const result = await analyzeProject({
      projectRoot,
      useDefaultExclusions: false
    });

    expect(result.thresholdExceeded).toBe(true);
    expect(result.metrics.map((metric) => metric.displayName)).toEqual(["tooComplex"]);
    expect(result.exclusionAudit.excludedFiles).toBe(0);
  });

  it("keeps generated build-output src roots discoverable when default exclusions are disabled", async () => {
    const projectRoot = await createTempDir("cognitive-exclusions-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "dist/src/generated.ts": buildDeepNestedIfFunction("tooComplex", 7),
      "src/manual.ts": buildSimpleFunction("safe")
    });

    const result = await analyzeProject({
      projectRoot,
      useDefaultExclusions: false
    });

    expect(result.thresholdExceeded).toBe(true);
    expect(result.metrics.map((metric) => metric.displayName)).toEqual(["tooComplex", "safe"]);
    expect(result.exclusionAudit.excludedFiles).toBe(0);
  });

  it("covers declaration and test-path default exclusions", async () => {
    const projectRoot = await createTempDir("cognitive-exclusions-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/types.d.ts": "export declare const typed: string;\n",
      "src/__tests__/helper.ts": buildDeepNestedIfFunction("testHelper", 7),
      "src/manual.test.ts": buildDeepNestedIfFunction("manualTest", 7),
      "src/manual.ts": buildSimpleFunction("safe")
    });

    const result = await analyzeProject({ projectRoot });

    expect(result.thresholdExceeded).toBe(false);
    expect(result.metrics.map((metric) => metric.displayName)).toEqual(["safe"]);
    expect(result.exclusionAudit.excludedFileReasons).toEqual(expect.arrayContaining([
      { reason: "default:path:declaration-file", count: 1 },
      { reason: "default:path:test-directory", count: 1 },
      { reason: "default:path:test-file", count: 1 }
    ]));
  });

  it("applies configured name, decorator, and comment exclusions before threshold evaluation", async () => {
    const projectRoot = await createTempDir("cognitive-exclusions-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/sample.ts": `class Sample {
  @Generated
  decorated(${parameters(7)}) {
${nestedIfBody(7, 4)}
  }

  /* @custom-generated */
  commented(${parameters(7)}) {
${nestedIfBody(7, 4)}
  }

  safe(value: boolean): number {
    if (value) {
      return 1;
    }
    return 0;
  }
}

export function makeFactory(${parameters(7)}): number {
${nestedIfBody(7, 2)}
}
`
    });

    const result = await analyzeProject({
      projectRoot,
      excludeNames: [".*Factory$"],
      excludeDecorators: ["Generated"],
      excludeComments: ["@custom-generated"]
    });

    expect(result.thresholdExceeded).toBe(false);
    expect(result.metrics.map((metric) => metric.displayName)).toEqual(["Sample.safe"]);
    expect(result.exclusionAudit).toMatchObject({
      analyzedFiles: 1,
      analyzedFunctions: 1,
      excludedFunctions: 3
    });
    expect(result.exclusionAudit.excludedFunctionReasons).toEqual(expect.arrayContaining([
      { reason: "user:comment:@custom-generated", count: 1 },
      { reason: "user:decorator:Generated", count: 1 },
      { reason: "user:name:.*Factory$", count: 1 }
    ]));
  });

  it("matches configured decorators with an optional leading at-sign", async () => {
    const projectRoot = await createTempDir("cognitive-exclusions-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": "{\"name\":\"fixture\",\"private\":true}",
      "src/sample.ts": `class Sample {
  @Generated
  decorated(${parameters(7)}) {
${nestedIfBody(7, 2)}
  }
}
`
    });

    const result = await analyzeProject({
      projectRoot,
      excludeDecorators: ["@Generated"]
    });

    expect(result.thresholdExceeded).toBe(false);
    expect(result.metrics).toEqual([]);
    expect(result.exclusionAudit.excludedFunctionReasons).toContainEqual({
      reason: "user:decorator:@Generated",
      count: 1
    });
  });

  it("matches property-access decorators by simple name", async () => {
    const projectRoot = await createTempDir("cognitive-exclusions-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": "{\"name\":\"fixture\",\"private\":true}",
      "src/sample.ts": `const decorators = {
  Generated() {
    return function (): void {};
  }
};

class Sample {
  @decorators.Generated()
  decorated(${parameters(7)}) {
${nestedIfBody(7, 2)}
  }
}
`
    });

    const result = await analyzeProject({
      projectRoot,
      excludeDecorators: ["Generated"]
    });

    expect(result.thresholdExceeded).toBe(false);
    expect(result.metrics.map((metric) => metric.displayName)).toEqual(["decorators.Generated"]);
    expect(result.exclusionAudit.excludedFunctionReasons).toContainEqual({
      reason: "user:decorator:Generated",
      count: 1
    });
  });

  it("matches configured glob exclusions with wildcard and literal regex characters", async () => {
    const projectRoot = await createTempDir("cognitive-exclusions-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": "{\"name\":\"fixture\",\"private\":true}",
      "src/[literal].ts": buildDeepNestedIfFunction("literal", 7),
      "packages/web/src/skip.ts": buildDeepNestedIfFunction("skip", 7),
      "packages/ui/src/file1.ts": buildDeepNestedIfFunction("file1", 7),
      "src/manual.ts": buildSimpleFunction("safe")
    });

    const result = await analyzeProject({
      projectRoot,
      useDefaultExclusions: false,
      excludes: ["src/[literal].ts", "packages/*/src/skip.ts", "packages/**/file?.ts"]
    });

    expect(result.thresholdExceeded).toBe(false);
    expect(result.metrics.map((metric) => metric.displayName)).toEqual(["safe"]);
    expect(result.exclusionAudit.excludedFileReasons).toEqual(expect.arrayContaining([
      { reason: "user:path:src/[literal].ts", count: 1 },
      { reason: "user:path:packages/*/src/skip.ts", count: 1 },
      { reason: "user:path:packages/**/file?.ts", count: 1 }
    ]));
  });
});

function buildSimpleFunction(name: string): string {
  return `export function ${name}(value: boolean): number {
  if (value) {
    return 1;
  }
  return 0;
}
`;
}

function buildDeepNestedIfFunction(name: string, depth: number): string {
  return `export function ${name}(${parameters(depth)}): number {
${nestedIfBody(depth, 2)}
}
`;
}

function parameters(depth: number): string {
  return Array.from({ length: depth }, (_value, index) => `flag${index + 1}: boolean`).join(", ");
}

function nestedIfBody(depth: number, returnIndentLevels: number): string {
  const lines: string[] = [];
  let indent = "    ";
  for (let index = 0; index < depth; index += 1) {
    lines.push(`${indent}if (flag${index + 1}) {`);
    indent += "  ";
  }
  lines.push(`${indent}return 1;`);
  for (let index = depth - 1; index >= 0; index -= 1) {
    indent = indent.slice(0, -2);
    lines.push(`${indent}}`);
  }
  lines.push(`${"  ".repeat(returnIndentLevels)}return 0;`);
  return lines.join("\n");
}
