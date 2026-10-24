import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { archiveName, packages, readJson } from "./release-lib.mjs";
import { npm, verifyManifest } from "./release-artifacts.mjs";

const { values } = parseArgs({
  options: {
    registry: { type: "boolean", default: false },
    "artifacts-dir": { type: "string", default: "release-artifacts" }
  }
});
const artifactDirectory = path.resolve(values["artifacts-dir"]);
const manifests = packages();
const lock = readJson("package-lock.json");
const lockedVersion = (name) => lock.packages[`node_modules/${name}`].version;
const currentVitest = lockedVersion("vitest");
assert.equal(lockedVersion("@vitest/coverage-v8"), currentVitest);
if (!values.registry) {
  const files = verifyManifest(artifactDirectory);
  for (const pkg of manifests) {
    assert.ok(files.has(archiveName(pkg)), `Missing archive checksum: ${pkg.name}`);
    assert.ok(files.has(`${archiveName(pkg)}.cdx.json`), `Missing SBOM checksum: ${pkg.name}`);
  }
}

function execute(directory, args, scenario, expected = 0) {
  const result = spawnSync(process.execPath, args, {
    cwd: directory,
    env: { ...process.env, COGNITIVE_SMOKE_SCENARIO: scenario },
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    expected,
    `${scenario}: expected ${expected}, got ${result.status}\n${result.stdout}\n${result.stderr}`
  );
  return { stdout: result.stdout, output: `${result.stdout}\n${result.stderr}` };
}

function verifyExports(directory) {
  execute(
    directory,
    [
      "--input-type=module",
      "--eval",
      `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import * as core from '@barney-media/cognitive-typescript-core';
    import * as cli from '@barney-media/cognitive-typescript';
    import * as vitest from '@barney-media/cognitive-typescript-vitest';
    import * as jest from '@barney-media/cognitive-typescript-jest';
    const require = createRequire(import.meta.url);
    assert.equal(core.COGNITIVE_COMPLEXITY_THRESHOLD, 8);
    assert.equal(typeof cli.runCli, 'function');
    assert.equal(vitest.withCognitiveTypescriptVitest({}).test.reporters.length, 2);
    assert.equal(jest.withCognitiveTypescriptJest({}).reporters.length, 2);
    assert.equal(typeof require('@barney-media/cognitive-typescript-jest/reporter').default, 'function');
    const analysis = await core.analyzeProject({ projectRoot: process.cwd(), explicitPaths: ['src/safe.ts'] });
    assert.equal(analysis.threshold, 8);
    assert.equal(analysis.maxCognitiveComplexity, 1);
  `
    ],
    "exports"
  );
  for (const pkg of manifests) {
    const installed = readJson(path.join(directory, "node_modules", pkg.name, "package.json"));
    assert.equal(installed.version, pkg.version);
    assert.equal(installed.engines.node, ">=22.13.0");
    if (pkg.folder === "vitest") assert.equal(installed.peerDependencies.vitest, "^4.0.0 || ^5.0.0");
    if (pkg.folder === "jest") assert.equal(installed.peerDependencies.jest, "^30.0.0");
  }
}

function verifyScenario(directory, runner, scenario) {
  const failed = ["threshold", "disabled"].includes(scenario);
  const expected = scenario === "error" ? 1 : failed ? 2 : 0;
  const command =
    runner === "jest"
      ? ["node_modules/jest/bin/jest.js", "--config", "jest.config.cjs", "--runInBand"]
      : ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.config.mjs"];
  const { output } = execute(directory, command, scenario, expected);
  assert.equal(
    existsSync(path.join(directory, `coverage-${scenario}`, "coverage-final.json")),
    scenario !== "disabled"
  );
  if (scenario === "error") {
    assert.match(output, /output must target a report file/);
    return;
  }
  const reportDirectory = path.join(directory, "reports", scenario);
  const report = readJson(path.join(reportDirectory, "primary.json"));
  assert.equal(report.status, failed ? "failed" : "passed");
  assert.equal(report.threshold, 8);
  assert.ok(report.methods.some((method) => method.method === "safe"));
  assert.equal(
    report.methods.some((method) => method.method === "risky"),
    failed
  );
  assert.equal(
    report.methods.some((method) => method.method === "ignored"),
    false
  );
  const junitPath = path.join(reportDirectory, "TEST-cognitive.xml");
  assert.equal(existsSync(junitPath), scenario !== "no-junit");
  if (scenario !== "no-junit") {
    const junit = readFileSync(junitPath, "utf8");
    assert.match(junit, /safe:/);
    assert.equal(junit.includes("<failure"), failed);
  }
  if (failed) assert.equal(output.match(/Cognitive Complexity threshold exceeded/g)?.length, 1);
  if (scenario === "explicit") assert.match(output, /CUSTOM_REPORTER_FINISHED/);
}

function verifyCli(directory) {
  const command = ["node_modules/@barney-media/cognitive-typescript/dist/bin.js"];
  execute(directory, [...command, "--help"], "help");
  for (const format of ["json", "toon", "text", "junit", "none"]) {
    const { stdout } = execute(directory, [...command, "--format", format, "src"], `cli-${format}`, 2);
    if (format === "none") assert.equal(stdout, "");
    else if (format === "json") {
      const report = JSON.parse(stdout);
      assert.equal(report.status, "failed");
      assert.equal(report.threshold, 8);
      assert.ok(report.methods.some((method) => method.method === "risky" && method.cc === 10));
    } else assert.match(stdout, /risky/);
  }
  execute(directory, [...command, "--threshold", "99", "src"], "cli-pass");
  execute(directory, [...command, "--format", "invalid", "src"], "cli-invalid", 1);
}

function verifyConsumer(runner, vitestVersion) {
  const temporaryRoot = path.resolve(tmpdir());
  const directory = mkdtempSync(path.join(temporaryRoot, "cognitive-release-smoke-"));
  try {
    cpSync(path.resolve("tests/fixtures/release-consumer"), directory, { recursive: true });
    writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: "release-consumer", private: true }));
    const dependencies = manifests.map((pkg) =>
      values.registry ? `${pkg.name}@${pkg.version}` : path.join(artifactDirectory, archiveName(pkg))
    );
    npm(
      [
        "install",
        "--prefer-online",
        "--ignore-scripts",
        "--strict-peer-deps",
        "--engine-strict",
        "--no-audit",
        "--no-fund",
        ...dependencies,
        `vitest@${vitestVersion}`,
        `@vitest/coverage-v8@${vitestVersion}`,
        `vite@${lockedVersion("vite")}`,
        `jest@${lockedVersion("jest")}`,
        `ts-jest@${lockedVersion("ts-jest")}`,
        `typescript@${lockedVersion("typescript")}`
      ],
      { cwd: directory, stdio: "inherit" }
    );
    for (const name of ["vitest", "@vitest/coverage-v8"]) {
      assert.equal(readJson(path.join(directory, "node_modules", name, "package.json")).version, vitestVersion);
    }
    verifyExports(directory);
    for (const scenario of ["pass", "threshold", "disabled", "explicit", "excluded", "no-junit", "error"]) {
      verifyScenario(directory, runner, scenario);
    }
    verifyCli(directory);
    if (values.registry) npm(["audit", "signatures"], { cwd: directory, stdio: "inherit" });
    console.log(`Verified ${runner} consumer (Vitest ${vitestVersion}, Node ${process.versions.node})`);
  } finally {
    assert.equal(path.dirname(directory), temporaryRoot);
    assert.ok(path.basename(directory).startsWith("cognitive-release-smoke-"));
    rmSync(directory, { recursive: true, force: true });
  }
}

verifyConsumer("vitest", "4.1.12");
verifyConsumer("vitest", currentVitest);
verifyConsumer("jest", currentVitest);
