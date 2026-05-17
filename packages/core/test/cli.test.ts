import { afterEach, describe, expect, it } from "vitest";

import { parseCliArguments, runCli } from "../src/index";
import { StringWriter, createTempDir, disposeTempDir, readText, writeProjectFiles } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("cli", () => {
  it("parses help and changed modes", () => {
    expect(parseCliArguments(["--help"])).toEqual({ mode: "help", fileArgs: [] });
    expect(parseCliArguments(["--changed"])).toMatchObject({ mode: "changed", fileArgs: [] });
    expect(() => parseCliArguments(["--changed", "src"])).toThrow("--changed cannot be combined with file arguments");
  });

  it("parses report controls and inline valued options", () => {
    expect(parseCliArguments([
      "--changed",
      "--format=json",
      "--agent",
      "--failures-only=false",
      "--omit-redundancy=false",
      "--output",
      "reports/primary.json",
      "--junit-report=reports/junit.xml",
      "--threshold",
      "9"
    ])).toEqual({
      mode: "changed",
      fileArgs: [],
      format: "json",
      threshold: 9,
      agent: true,
      failuresOnly: false,
      omitRedundancy: false,
      output: "reports/primary.json",
      junitReport: "reports/junit.xml"
    });
  });

  it("rejects duplicate options, strict boolean violations, and invalid thresholds", () => {
    expect(() => parseCliArguments(["--format", "json", "--format=text"])).toThrow(
      "--format can only be provided once"
    );
    expect(() => parseCliArguments(["--format"])).toThrow("--format requires a format");
    expect(() => parseCliArguments(["--format="])).toThrow("--format requires a format");
    expect(() => parseCliArguments(["--format", "--agent"])).toThrow("--format requires a format");
    expect(() => parseCliArguments(["--output", "--agent"])).toThrow("--output requires a path");
    expect(() => parseCliArguments(["--threshold", "--agent"])).toThrow("--threshold requires a positive integer");
    expect(() => parseCliArguments(["--failures-only=True"])).toThrow(
      "--failures-only requires true or false when a value is provided"
    );
    expect(() => parseCliArguments(["--omit-redundancy=yes"])).toThrow(
      "--omit-redundancy requires true or false when a value is provided"
    );
    expect(() => parseCliArguments(["--threshold", "1.5"])).toThrow("--threshold requires a positive integer");
    expect(() => parseCliArguments(["--output="])).toThrow("--output requires a path");
    expect(() => parseCliArguments(["--output", " reports/primary.json "])).toThrow(
      "--output must not include leading or trailing whitespace"
    );
    expect(() => parseCliArguments(["--help", "--changed"])).toThrow(
      "--help cannot be combined with other options or file arguments"
    );
    expect(() => parseCliArguments(["--help", "src"])).toThrow(
      "--help cannot be combined with other options or file arguments"
    );
  });

  it("applies agent defaults and explicit overrides", () => {
    expect(parseCliArguments(["--agent"])).toMatchObject({
      format: "toon",
      agent: true,
      failuresOnly: true,
      omitRedundancy: true
    });
    expect(parseCliArguments(["--agent", "--format=text", "--failures-only=false", "--omit-redundancy=false"]))
      .toMatchObject({
        format: "text",
        failuresOnly: false,
        omitRedundancy: false
      });
  });

  it("prints an empty passed report for empty projects", async () => {
    const projectRoot = await createTempDir("cognitive-cli-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}'
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const exitCode = await runCli([], projectRoot, stdout, stderr);

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toBe("status: passed\nthreshold: 15\nmethods[0]:\n");
    expect(stderr.toString()).toBe("");
  });

  it("prints usage and returns 0 for --help", async () => {
    const stdout = new StringWriter();
    const stderr = new StringWriter();

    const exitCode = await runCli(["--help"], process.cwd(), stdout, stderr);

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain("Usage:");
    expect(stdout.toString()).toContain("Exit codes:");
    expect(stderr.toString()).toBe("");
  });

  it("prints the parse error and usage for invalid arguments", async () => {
    const stdout = new StringWriter();
    const stderr = new StringWriter();

    const exitCode = await runCli(["--changed", "src"], process.cwd(), stdout, stderr);

    expect(exitCode).toBe(1);
    expect(stdout.toString()).toBe("");
    expect(stderr.toString()).toContain("--changed cannot be combined with file arguments");
    expect(stderr.toString()).toContain("Usage:");
  });

  it("returns exit code 2 when the threshold is exceeded", async () => {
    const projectRoot = await createTempDir("cognitive-cli-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/sample.ts": `${buildDeepNestedIfFunction("tooComplex", 7)}`
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const exitCode = await runCli([], projectRoot, stdout, stderr);

    expect(exitCode).toBe(2);
    expect(stdout.toString()).toContain("tooComplex");
    expect(stderr.toString()).toContain("Cognitive Complexity threshold exceeded: 28 > 15");
  });

  it("uses configured thresholds for exit code decisions", async () => {
    const projectRoot = await createTempDir("cognitive-cli-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/sample.ts": `${buildDeepNestedIfFunction("tooComplex", 7)}`
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const exitCode = await runCli(["--threshold=30"], projectRoot, stdout, stderr);

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain("threshold: 30");
    expect(stderr.toString()).toBe("");
  });

  it("writes primary output files and full JUnit sidecars", async () => {
    const projectRoot = await createTempDir("cognitive-cli-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/sample.ts": `${buildDeepNestedIfFunction("tooComplex", 7)}

export function safe(value: number): number {
  return value + 1;
}
`
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const exitCode = await runCli([
      "--format=json",
      "--failures-only",
      "--output=reports/primary.json",
      "--junit-report",
      "reports/junit.xml"
    ], projectRoot, stdout, stderr);
    const primary = JSON.parse(await readText(`${projectRoot}/reports/primary.json`)) as {
      methods: Array<{ method: string }>;
    };
    const junit = await readText(`${projectRoot}/reports/junit.xml`);

    expect(exitCode).toBe(2);
    expect(stdout.toString()).toBe("");
    expect(primary.methods).toEqual([expect.objectContaining({ method: "tooComplex" })]);
    expect(junit).toContain('tests="2"');
    expect(junit).toContain('name="tooComplex:1"');
    expect(junit).toContain('name="safe:20"');
    expect(junit).toContain("Cognitive Complexity: 28");
    expect(stderr.toString()).toContain("Cognitive Complexity threshold exceeded");
  });

  it("writes empty primary files for none reports", async () => {
    const projectRoot = await createTempDir("cognitive-cli-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/sample.ts": "export function safe(value: number): number { return value + 1; }\n"
    });

    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const exitCode = await runCli([
      "--format=none",
      "--output=reports/empty.txt"
    ], projectRoot, stdout, stderr);

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toBe("");
    expect(await readText(`${projectRoot}/reports/empty.txt`)).toBe("");
    expect(stderr.toString()).toBe("");
  });

  it("rejects report paths that escape or collide", async () => {
    const projectRoot = await createTempDir("cognitive-cli-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/sample.ts": "export function safe(value: number): number { return value + 1; }\n"
    });

    const escapeStdout = new StringWriter();
    const escapeStderr = new StringWriter();
    expect(await runCli(["--output=../outside.txt"], projectRoot, escapeStdout, escapeStderr)).toBe(1);
    expect(escapeStderr.toString()).toContain("--output must stay inside the project root");

    const collisionStdout = new StringWriter();
    const collisionStderr = new StringWriter();
    expect(await runCli([
      "--output=reports/result.xml",
      "--junit-report=reports/result.xml"
    ], projectRoot, collisionStdout, collisionStderr)).toBe(1);
    expect(collisionStderr.toString()).toContain("--output and --junit-report must target different report files");
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
