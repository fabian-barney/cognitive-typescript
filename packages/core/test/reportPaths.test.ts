import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateReportPathTargets } from "../src/reportPaths";
import { createTempDir, disposeTempDir, writeProjectFiles } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("reportPaths", () => {
  it("accepts nested report files inside missing directories", async () => {
    const projectRoot = await createTempDir("cognitive-report-paths-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}'
    });

    await expect(validateReportPathTargets(projectRoot, [
      { label: "--output", path: "reports/nested/result.json" }
    ])).resolves.toBeUndefined();
  });

  it("rejects project-root, filesystem-root, and directory targets", async () => {
    const projectRoot = await createTempDir("cognitive-report-paths-");
    tempDirs.push(projectRoot);
    await writeProjectFiles(projectRoot, {
      "package.json": '{"name":"fixture","private":true}',
      "reports/.gitkeep": ""
    });

    await expect(validateReportPathTargets(projectRoot, [
      { label: "--output", path: "." }
    ])).rejects.toThrow("--output must target a report file, not the project root");

    await expect(validateReportPathTargets(projectRoot, [
      { label: "--output", path: path.parse(projectRoot).root }
    ])).rejects.toThrow("--output must target a report file, not a filesystem root");

    await expect(validateReportPathTargets(projectRoot, [
      { label: "--output", path: "reports" }
    ])).rejects.toThrow("--output must target a report file, not an existing directory");
  });
});
