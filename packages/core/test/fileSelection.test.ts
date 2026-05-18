import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  changedTypeScriptFilesUnderSourceRoots,
  expandExplicitPaths,
  findAllTypeScriptFilesUnderSourceRoots
} from "../src/index";
import { createTempDir, disposeTempDir, initGitRepository, runProcess, writeProjectFiles } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("file selection", () => {
  it("finds TypeScript files under nested src roots as analysis candidates", async () => {
    const projectRoot = await createTempDir("cognitive-files-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "src/a.ts": "export const a = 1;\n",
      "src/b.tsx": "export const B = () => <div />;\n",
      "src/c.mts": "export const c = 1;\n",
      "src/d.cts": "export const d = 1;\n",
      "src/skip.d.ts": "export declare const skip: string;\n",
      "src/skip.test.ts": "export const skip = 1;\n",
      "packages/app/src/app.ts": "export const app = 1;\n",
      "packages/app/dist/out.ts": "export const out = 1;\n"
    });

    const files = await findAllTypeScriptFilesUnderSourceRoots(projectRoot);
    expect(files.map((file) => path.relative(projectRoot, file).replace(/\\/g, "/"))).toEqual([
      "packages/app/src/app.ts",
      "src/a.ts",
      "src/b.tsx",
      "src/c.mts",
      "src/d.cts",
      "src/skip.d.ts",
      "src/skip.test.ts"
    ]);
  });

  it("expands explicit files and directories", async () => {
    const projectRoot = await createTempDir("cognitive-files-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "src/root.ts": "export const root = 1;\n",
      "packages/web/src/page.ts": "export const page = 1;\n",
      "packages/web/test/page.test.ts": "export const testValue = 1;\n"
    });

    const files = await expandExplicitPaths(projectRoot, ["src/root.ts", "packages/web"]);
    expect(files.map((file) => path.relative(projectRoot, file).replace(/\\/g, "/"))).toEqual([
      "packages/web/src/page.ts",
      "src/root.ts"
    ]);
  });

  it("detects changed files under src roots only", async () => {
    const projectRoot = await createTempDir("cognitive-files-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "src/tracked.ts": "export const tracked = 1;\n"
    });
    await initGitRepository(projectRoot);
    await runProcess("git", ["add", "."], projectRoot);
    await runProcess("git", ["commit", "-m", "initial"], projectRoot);

    await writeProjectFiles(projectRoot, {
      "src/changed.ts": "export const changed = 1;\n",
      "docs/readme.ts": "export const docs = 1;\n"
    });

    const changed = await changedTypeScriptFilesUnderSourceRoots(projectRoot);
    expect(changed.map((file) => path.relative(projectRoot, file).replace(/\\/g, "/"))).toEqual([
      "src/changed.ts"
    ]);
  });
});
