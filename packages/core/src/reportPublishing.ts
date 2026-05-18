import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { formatAnalysisReport } from "./report";
import { assertInsideProjectRoot, validateReportPathTargets } from "./reportPaths";
import type { PublishAnalysisReportsOptions } from "./types";

export async function publishAnalysisReports(options: PublishAnalysisReportsOptions): Promise<void> {
  await validateReportPathTargets(options.projectRoot, [
    { label: "--output", path: options.output },
    { label: "--junit-report", path: options.junitReport }
  ]);

  const primaryReport = formatAnalysisReport(options.metrics, {
    format: options.format,
    agent: options.agent,
    threshold: options.threshold,
    failuresOnly: options.failuresOnly,
    omitRedundancy: options.omitRedundancy,
    elapsedSeconds: options.elapsedSeconds
  });
  if (options.output) {
    await writeReportFile(options.projectRoot, options.output, primaryReport);
  } else if (primaryReport.length > 0) {
    options.stdout.write(primaryReport);
  }

  if (options.junitReport) {
    await writeReportFile(
      options.projectRoot,
      options.junitReport,
      formatAnalysisReport(options.metrics, {
        format: "junit",
        threshold: options.threshold,
        elapsedSeconds: options.elapsedSeconds
      })
    );
  }
}

export async function deleteOwnedReportFile(projectRoot: string, reportPath: string | undefined): Promise<void> {
  if (!reportPath) {
    return;
  }
  const absoluteProjectRoot = path.resolve(projectRoot);
  const absolutePath = path.resolve(projectRoot, reportPath);
  if (!isInsideProjectRoot(absoluteProjectRoot, absolutePath)) {
    return;
  }
  if (!(await isOwnedJunitSidecar(absolutePath))) {
    return;
  }
  await rm(absolutePath, { force: true });
}

async function writeReportFile(projectRoot: string, reportPath: string, content: string): Promise<void> {
  const absolutePath = path.resolve(projectRoot, reportPath);
  assertInsideProjectRoot(path.resolve(projectRoot), absolutePath, "Report path");
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

async function isOwnedJunitSidecar(reportPath: string): Promise<boolean> {
  try {
    const content = await readFile(reportPath, "utf8");
    return content.includes("<testsuites") && content.includes('name="cognitive-typescript"');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function isInsideProjectRoot(projectRoot: string, targetPath: string): boolean {
  const relative = path.relative(projectRoot, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
