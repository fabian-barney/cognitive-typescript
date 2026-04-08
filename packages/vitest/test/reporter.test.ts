import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StringWriter, createTempDir, disposeTempDir, writeProjectFiles } from "../../core/test/testUtils";
import { CognitiveTypescriptVitestReporter } from "../src/index";

const tempDirs: string[] = [];
let originalExitCode: number | undefined;

beforeEach(() => {
  originalExitCode = process.exitCode;
});

afterEach(async () => {
  process.exitCode = originalExitCode;
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("CognitiveTypescriptVitestReporter", () => {
  it("prints the no-files message when no analyzable source files are selected", async () => {
    const projectRoot = await createTempDir("cognitive-vitest-reporter-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}'
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const reporter = new CognitiveTypescriptVitestReporter({
      projectRoot,
      stdout,
      stderr
    });

    await reporter.onTestRunEnd();

    expect(stdout.toString()).toContain("No TypeScript files to analyze.");
    expect(stderr.toString()).toBe("");
  });

  it("prints the report and sets a failure exit code when the threshold is exceeded", async () => {
    const projectRoot = await createTempDir("cognitive-vitest-reporter-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/sample.ts": `${buildDeepNestedIfFunction("tooComplex", 7)}`
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const reporter = new CognitiveTypescriptVitestReporter({
      projectRoot,
      paths: ["src"],
      stdout,
      stderr
    });

    await reporter.onTestRunEnd();

    expect(stdout.toString()).toContain("tooComplex");
    expect(stderr.toString()).toContain("Cognitive Complexity threshold exceeded");
    expect(process.exitCode).toBe(1);
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
