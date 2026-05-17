import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StringWriter, createTempDir, disposeTempDir, writeProjectFiles } from "../../core/test/testUtils";
import { CognitiveTypescriptVitestReporter } from "../src/index";

const tempDirs: string[] = [];
const DEFAULT_JUNIT_REPORT = path.join("reports", "cognitive-typescript", "TEST-cognitive-typescript.xml");
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

  it("writes only the default JUnit sidecar with default report controls", async () => {
    const projectRoot = await createProject({
      "src/sample.ts": buildSimpleFunction("safe")
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

    expect(stdout.toString()).toBe("");
    expect(stderr.toString()).toBe("");
    const junit = await readText(path.join(projectRoot, DEFAULT_JUNIT_REPORT));
    expect(junit).toContain("<testsuites");
    expect(junit).toContain('classname="src/sample.ts"');
    expect(junit).toContain('<property name="status" value="passed"/>');
  });

  it("writes configured primary and JUnit reports through the shared pipeline", async () => {
    const projectRoot = await createProject({
      "src/sample.ts": buildSimpleFunction("safe")
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const reporter = new CognitiveTypescriptVitestReporter({
      projectRoot,
      paths: ["src"],
      format: "json",
      agent: true,
      failuresOnly: false,
      omitRedundancy: true,
      output: "reports/primary.json",
      junit: true,
      junitReport: "reports/custom-junit.xml",
      threshold: 9,
      stdout,
      stderr
    });

    await reporter.onTestRunEnd();

    expect(stdout.toString()).toBe("");
    expect(stderr.toString()).toBe("");
    const primary = JSON.parse(await readText(path.join(projectRoot, "reports", "primary.json"))) as {
      threshold: number;
      methods: Array<Record<string, unknown>>;
    };
    expect(primary.threshold).toBe(9);
    expect(primary.methods).toEqual([
      expect.objectContaining({
        method: "safe"
      })
    ]);
    expect(primary.methods[0]).not.toHaveProperty("status");
    expect(existsSync(path.join(projectRoot, DEFAULT_JUNIT_REPORT))).toBe(false);
    const junit = await readText(path.join(projectRoot, "reports", "custom-junit.xml"));
    expect(junit).toContain('classname="src/sample.ts"');
    expect(junit).toContain('<property name="status" value="passed"/>');
  });

  it("lets explicit agent overrides keep full output", async () => {
    const projectRoot = await createProject({
      "src/sample.ts": `${buildSimpleFunction("safe")}\n\n${buildDeepNestedIfFunction("tooComplex", 7)}`
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const reporter = new CognitiveTypescriptVitestReporter({
      projectRoot,
      paths: ["src"],
      format: "json",
      agent: true,
      failuresOnly: false,
      omitRedundancy: false,
      stdout,
      stderr
    });

    await reporter.onTestRunEnd();

    const primary = JSON.parse(stdout.toString()) as {
      methods: Array<Record<string, unknown>>;
    };
    expect(primary.methods).toHaveLength(2);
    expect(primary.methods).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "safe", status: "passed" }),
      expect.objectContaining({ method: "tooComplex", status: "failed" })
    ]));
    expect(stderr.toString()).toContain("Cognitive Complexity threshold exceeded");
    expect(process.exitCode).toBe(2);
  });

  it("suppresses and cleans the JUnit sidecar when junit is disabled", async () => {
    const projectRoot = await createProject({
      "src/sample.ts": buildSimpleFunction("safe")
    });
    await mkdir(path.dirname(path.join(projectRoot, DEFAULT_JUNIT_REPORT)), { recursive: true });
    await writeFile(path.join(projectRoot, DEFAULT_JUNIT_REPORT), "stale");

    const reporter = new CognitiveTypescriptVitestReporter({
      projectRoot,
      paths: ["src"],
      format: "json",
      output: "reports/primary.json",
      junit: false,
      stdout: new StringWriter(),
      stderr: new StringWriter()
    });

    await reporter.onTestRunEnd();

    expect(existsSync(path.join(projectRoot, DEFAULT_JUNIT_REPORT))).toBe(false);
    expect(await readText(path.join(projectRoot, "reports", "primary.json"))).toContain('"status": "passed"');
  });

  it("reports invalid report paths as configuration errors", async () => {
    const projectRoot = await createProject({
      "src/sample.ts": buildSimpleFunction("safe")
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const reporter = new CognitiveTypescriptVitestReporter({
      projectRoot,
      paths: ["src"],
      output: "../outside.json",
      stdout,
      stderr
    });

    await reporter.onTestRunEnd();

    expect(stdout.toString()).toBe("");
    expect(stderr.toString()).toContain("--output must stay inside the project root");
    expect(process.exitCode).toBe(1);
  });

  it("sets exit code 2 when the threshold is exceeded", async () => {
    const projectRoot = await createProject({
      "src/sample.ts": buildDeepNestedIfFunction("tooComplex", 7)
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const reporter = new CognitiveTypescriptVitestReporter({
      projectRoot,
      paths: ["src"],
      format: "text",
      stdout,
      stderr
    });

    await reporter.onTestRunEnd();

    expect(stdout.toString()).toContain("tooComplex");
    expect(stderr.toString()).toContain("Cognitive Complexity threshold exceeded");
    expect(process.exitCode).toBe(2);
  });
});

async function createProject(files: Record<string, string>): Promise<string> {
  const projectRoot = await createTempDir("cognitive-vitest-reporter-");
  tempDirs.push(projectRoot);
  await writeProjectFiles(projectRoot, {
    "package.json": '{"name":"fixture","private":true}',
    ...files
  });
  return projectRoot;
}

function buildSimpleFunction(name: string): string {
  return `export function ${name}(value: boolean): number {
  if (value) {
    return 1;
  }
  return 0;
}`;
}

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

async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}
