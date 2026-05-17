import { afterEach, describe, expect, it } from "vitest";

import { copyFixture, disposeTempDir, repoPath, runProcess, writeProjectFiles } from "../../core/test/testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("cognitive-typescript-vitest", () => {
  it("fails the Vitest run when the threshold is exceeded", async () => {
    const projectRoot = await copyFixture("vitest-project");
    tempDirs.push(projectRoot);
    const adapterPath = repoPath("packages", "vitest", "dist", "index.js").replace(/\\/g, "/");
    await writeProjectFiles(projectRoot, {
      "src/sample.ts": `export function safe(value: number): number {
  return value + 1;
}

${buildDeepNestedIfFunction("tooComplex", 7)}
`,
      "vitest.config.cjs": `const { withCognitiveTypescriptVitest } = require(${JSON.stringify(adapterPath)});

module.exports = withCognitiveTypescriptVitest(
  {
    test: {
      include: ["test/**/*.test.ts"]
    }
  },
  {
    projectRoot: process.cwd()
  }
);
`
    });

    const result = await runProcess(
      process.execPath,
      [repoPath("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.config.cjs"],
      projectRoot
    );

    expect(result.exitCode).toBe(2);
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
