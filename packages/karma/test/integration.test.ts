import { afterEach, describe, expect, it } from "vitest";

import { copyFixture, disposeTempDir, repoPath, runProcess, writeProjectFiles } from "../../core/test/testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("cognitive-typescript-karma", () => {
  it("fails the Karma run when the threshold is exceeded", async () => {
    const projectRoot = await copyFixture("karma-project");
    tempDirs.push(projectRoot);
    const adapterPath = repoPath("packages", "karma", "dist", "index.js").replace(/\\/g, "/");
    const repoRootPath = process.cwd().replace(/\\/g, "/");
    await writeProjectFiles(projectRoot, {
      "src/sample.ts": `export function safe(value: number): number {
  return value + 1;
}

${buildDeepNestedIfFunction("tooComplex", 7)}
`,
      "karma.conf.cjs": `const { withCognitiveTypescriptKarma } = require(${JSON.stringify(adapterPath)});

module.exports = function configureKarma(config) {
  config.set(withCognitiveTypescriptKarma(
    {
      basePath: "",
      frameworks: ["jasmine"],
      files: ["test/**/*.spec.js"],
      plugins: [
        require(require.resolve("karma-jasmine", { paths: [${JSON.stringify(repoRootPath)}] })),
        require(require.resolve("karma-jsdom-launcher", { paths: [${JSON.stringify(repoRootPath)}] }))
      ],
      browsers: ["jsdom"],
      singleRun: true,
      reporters: ["progress"],
      logLevel: config.LOG_ERROR
    },
    {
      projectRoot: process.cwd(),
      paths: ["src"]
    }
  ));
};
`
    });

    const result = await runProcess(
      process.execPath,
      [repoPath("node_modules", "karma", "bin", "karma"), "start", "karma.conf.cjs", "--single-run"],
      projectRoot
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Cognitive Complexity threshold exceeded");
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
