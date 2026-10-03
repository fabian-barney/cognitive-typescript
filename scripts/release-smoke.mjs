import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { archiveName, packages } from "./release-lib.mjs";
import { npm } from "./release-artifacts.mjs";

const directory = mkdtempSync(path.join(tmpdir(), "cognitive-release-smoke-"));
const registry = process.argv.includes("--registry");
try {
  writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({ name: "release-consumer", private: true, type: "module" })
  );
  const dependencies = packages().map((pkg) =>
    registry ? `${pkg.name}@${pkg.version}` : path.resolve("release-artifacts", archiveName(pkg))
  );
  npm(["install", "--prefer-online", "--ignore-scripts", "--no-audit", "--no-fund", ...dependencies], {
    cwd: directory,
    stdio: "inherit"
  });
  mkdirSync(path.join(directory, "src"));
  writeFileSync(
    path.join(directory, "src/sample.ts"),
    "export function sample(flag: boolean) { if (flag) return 1; return 0; }\n"
  );
  const source = `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import * as core from '@barney-media/cognitive-typescript-core';
    import * as cli from '@barney-media/cognitive-typescript';
    import * as vitest from '@barney-media/cognitive-typescript-vitest';
    import * as jest from '@barney-media/cognitive-typescript-jest';
    const require = createRequire(import.meta.url);
    assert.equal(core.COGNITIVE_COMPLEXITY_THRESHOLD, 8);
    assert.equal(typeof core.analyzeProject, 'function');
    assert.equal(typeof cli.runCli, 'function');
    assert.equal(vitest.withCognitiveTypescriptVitest({}).test.reporters.length, 2);
    assert.equal(jest.withCognitiveTypescriptJest({}).reporters.length, 2);
    assert.equal(typeof require('@barney-media/cognitive-typescript-jest/reporter').default, 'function');
    const analysis = await core.analyzeProject({ projectRoot: process.cwd() });
    assert.equal(analysis.threshold, 8);
    assert.equal(analysis.maxCognitiveComplexity, 1);
  `;
  execFileSync(process.execPath, ["--input-type=module", "--eval", source], { cwd: directory, stdio: "inherit" });
  execFileSync(process.execPath, ["node_modules/@barney-media/cognitive-typescript/dist/bin.js", "--help"], {
    cwd: directory,
    stdio: "inherit"
  });
  if (registry) npm(["audit", "signatures"], { cwd: directory, stdio: "inherit" });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
