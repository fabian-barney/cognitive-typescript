import { symlink } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  isAnalyzableFile,
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

  it("prunes default generated/build directories during source-root discovery when requested", async () => {
    const projectRoot = await createTempDir("cognitive-files-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "src/root.ts": "export const root = 1;\n",
      "dist/src/root-generated.ts": "export const rootGenerated = 1;\n",
      "packages/web/src/page.ts": "export const page = 1;\n",
      "packages/web/dist/src/generated.ts": "export const generated = 1;\n",
      "packages/web/coverage/src/covered.ts": "export const covered = 1;\n",
      "packages/web/.next/src/next.ts": "export const next = 1;\n"
    });

    const files = await findAllTypeScriptFilesUnderSourceRoots(projectRoot, {
      pruneDefaultExcludedDirectories: true
    });
    expect(files.map((file) => path.relative(projectRoot, file).replace(/\\/g, "/"))).toEqual([
      "packages/web/src/page.ts",
      "src/root.ts"
    ]);
  });

  it("keeps declaration and implementation suffix handling explicit", () => {
    expect(isAnalyzableFile("C:/repo/src/file.ts")).toBe(true);
    expect(isAnalyzableFile("C:/repo/src/file.tsx")).toBe(true);
    expect(isAnalyzableFile("C:/repo/src/file.mts")).toBe(true);
    expect(isAnalyzableFile("C:/repo/src/file.cts")).toBe(true);
    expect(isAnalyzableFile("C:/repo/src/file.d.ts")).toBe(true);
    expect(isAnalyzableFile("C:/repo/src/file.d.mts")).toBe(true);
    expect(isAnalyzableFile("C:/repo/src/file.d.cts")).toBe(true);
    expect(isAnalyzableFile("C:/repo/src/file.js")).toBe(false);
  });

  it("does not prune build-output src roots when discovery pruning is disabled", async () => {
    const projectRoot = await createTempDir("cognitive-files-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "src/root.ts": "export const root = 1;\n",
      "packages/web/dist/src/generated.ts": "export const generated = 1;\n"
    });

    const files = await findAllTypeScriptFilesUnderSourceRoots(projectRoot);
    expect(files.map((file) => path.relative(projectRoot, file).replace(/\\/g, "/"))).toEqual([
      "packages/web/dist/src/generated.ts",
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

  it("prefers the destination path for renamed or copied src files", async () => {
    const changed = await changedTypeScriptFilesUnderSourceRoots(
      "C:/repo",
      async () => ({
        exitCode: 0,
        stdout: "R  src/old-name.ts\0src/new-name.ts\0C  src/original.ts\0src/copied.ts\0",
        stderr: "",
        stdoutComplete: true,
        stderrComplete: true,
        timedOut: false
      })
    );

    expect(changed.map((file) => path.relative("C:/repo", file).replace(/\\/g, "/"))).toEqual([
      "src/copied.ts",
      "src/new-name.ts"
    ]);
  });

  it("does not follow symlinked directories during discovery or explicit expansion", async () => {
    const projectRoot = await createTempDir("cognitive-files-");
    const linkedRoot = await createTempDir("cognitive-linked-");
    tempDirs.push(projectRoot, linkedRoot);
    await writeProjectFiles(projectRoot, {
      "src/root.ts": "export const root = 1;\n"
    });
    await writeProjectFiles(linkedRoot, {
      "src/linked.ts": "export const linked = 1;\n"
    });
    await symlink(
      linkedRoot,
      path.join(projectRoot, "linked"),
      process.platform === "win32" ? "junction" : "dir"
    );

    const discovered = await findAllTypeScriptFilesUnderSourceRoots(projectRoot);
    expect(discovered.map((file) => path.relative(projectRoot, file).replace(/\\/g, "/"))).toEqual([
      "src/root.ts"
    ]);

    const expanded = await expandExplicitPaths(projectRoot, ["linked"]);
    expect(expanded).toEqual([]);
  });

  it("reports git status timeouts with captured context", async () => {
    await expect(changedTypeScriptFilesUnderSourceRoots(
      "C:/repo",
      async () => ({
        exitCode: 1,
        stdout: "partial stdout",
        stderr: "partial stderr",
        stdoutComplete: true,
        stderrComplete: true,
        timedOut: true
      })
    )).rejects.toThrow(
      "git status --porcelain=v1 -z --untracked-files=all timed out after 30000ms (stdout: partial stdout; stderr: partial stderr)"
    );
  });

  it("rejects incomplete git status output on success", async () => {
    await expect(changedTypeScriptFilesUnderSourceRoots(
      "C:/repo",
      async () => ({
        exitCode: 0,
        stdout: "?? src/generated.ts [output truncated]",
        stderr: "",
        stdoutComplete: false,
        stderrComplete: true,
        timedOut: false
      })
    )).rejects.toThrow(
      "could not fully capture git status --porcelain=v1 -z --untracked-files=all output; refusing incomplete changed-file detection"
    );
  });

  it("sanitizes NUL bytes in git status error context", async () => {
    await expect(changedTypeScriptFilesUnderSourceRoots(
      "C:/repo",
      async () => ({
        exitCode: 0,
        stdout: "?? src/added.ts\0M  src/changed.ts\0",
        stderr: "",
        stdoutComplete: false,
        stderrComplete: true,
        timedOut: false
      })
    )).rejects.toThrow("stdout: ?? src/added.ts\\0M  src/changed.ts\\0");
  });

  it("surfaces git status failures from stderr or stdout", async () => {
    await expect(changedTypeScriptFilesUnderSourceRoots(
      "C:/repo",
      async () => ({
        exitCode: 1,
        stdout: "stdout fallback",
        stderr: "",
        stdoutComplete: true,
        stderrComplete: true,
        timedOut: false
      })
    )).rejects.toThrow("stdout fallback");
  });
});
