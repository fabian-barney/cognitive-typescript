import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { deleteOwnedReportFile } from "../src";
import { createTempDir, disposeTempDir } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("deleteOwnedReportFile", () => {
  it("removes owned cognitive-typescript junit sidecars inside the project root", async () => {
    const projectRoot = await createProjectRoot();
    const reportPath = path.join("reports", "cognitive-typescript", "TEST-cognitive-typescript.xml");
    const absolutePath = path.join(projectRoot, reportPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(
      absolutePath,
      '<?xml version="1.0" encoding="UTF-8"?><testsuites name="cognitive-typescript"></testsuites>'
    );

    await deleteOwnedReportFile(projectRoot, reportPath);

    expect(existsSync(absolutePath)).toBe(false);
  });

  it("keeps files that are not junit reports", async () => {
    const projectRoot = await createProjectRoot();
    const reportPath = path.join("reports", "cognitive-typescript", "TEST-cognitive-typescript.xml");
    const absolutePath = path.join(projectRoot, reportPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, "plain text");

    await deleteOwnedReportFile(projectRoot, reportPath);

    expect(existsSync(absolutePath)).toBe(true);
  });

  it("keeps junit reports that are not owned by cognitive-typescript", async () => {
    const projectRoot = await createProjectRoot();
    const reportPath = path.join("reports", "cognitive-typescript", "TEST-cognitive-typescript.xml");
    const absolutePath = path.join(projectRoot, reportPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(
      absolutePath,
      '<?xml version="1.0" encoding="UTF-8"?><testsuites name="other-tool"></testsuites>'
    );

    await deleteOwnedReportFile(projectRoot, reportPath);

    expect(existsSync(absolutePath)).toBe(true);
  });

  it("ignores missing files", async () => {
    const projectRoot = await createProjectRoot();

    await expect(deleteOwnedReportFile(projectRoot, "reports/missing.xml")).resolves.toBeUndefined();
  });

  it("ignores paths outside the project root", async () => {
    const projectRoot = await createProjectRoot();
    const externalReport = path.join(projectRoot, "..", "outside-junit.xml");
    await writeFile(
      externalReport,
      '<?xml version="1.0" encoding="UTF-8"?><testsuites name="cognitive-typescript"></testsuites>'
    );

    await deleteOwnedReportFile(projectRoot, "../outside-junit.xml");

    expect(existsSync(externalReport)).toBe(true);
  });
});

async function createProjectRoot(): Promise<string> {
  const projectRoot = await createTempDir("cognitive-typescript-report-publishing-");
  tempDirs.push(projectRoot);
  return projectRoot;
}
