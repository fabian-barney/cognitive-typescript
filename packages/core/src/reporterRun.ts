import { analyzeProject } from "./analyzeProject";
import { NO_ANALYZABLE_FUNCTIONS_MESSAGE, NO_FILES_MESSAGE } from "./constants";
import { deleteOwnedReportFile, publishAnalysisReports } from "./reportPublishing";
import { validateReportPathTargets } from "./reportPaths";
import type { AnalysisResult, ResolvedReporterReportOptions } from "./types";

export async function runReporterAnalysis(options: ResolvedReporterReportOptions): Promise<void> {
  await validateReportPathTargets(options.projectRoot, [
    { label: "--output", path: options.output },
    { label: "--junit-report", path: options.junit ? options.junitReport : undefined }
  ]);
  await deleteDisabledJunitReport(options);
  const result = await analyzeReporterProject(options);
  await publishReporterResult(options, result);
}

async function deleteDisabledJunitReport(options: ResolvedReporterReportOptions): Promise<void> {
  if (options.junit) {
    return;
  }
  await deleteOwnedReportFile(options.projectRoot, options.junitReport);
}

function analyzeReporterProject(options: ResolvedReporterReportOptions): Promise<AnalysisResult> {
  return analyzeProject({
    projectRoot: options.projectRoot,
    explicitPaths: options.paths,
    changedOnly: options.changedOnly,
    excludes: options.excludes,
    excludeNames: options.excludeNames,
    excludeDecorators: options.excludeDecorators,
    excludeComments: options.excludeComments,
    useDefaultExclusions: options.useDefaultExclusions,
    threshold: options.threshold
  });
}

async function publishReporterResult(options: ResolvedReporterReportOptions, result: AnalysisResult): Promise<void> {
  if (result.selectedFiles.length === 0) {
    options.stdout.write(`${NO_FILES_MESSAGE}\n`);
    return;
  }
  if (result.metrics.length === 0) {
    options.stdout.write(`${NO_ANALYZABLE_FUNCTIONS_MESSAGE}\n`);
    return;
  }

  await publishAnalysisReports({
    projectRoot: options.projectRoot,
    stdout: options.stdout,
    metrics: result.metrics,
    format: options.format,
    agent: options.agent,
    threshold: result.threshold,
    exclusionAudit: result.exclusionAudit,
    failuresOnly: options.failuresOnly,
    omitRedundancy: options.omitRedundancy,
    includePrimaryExclusionAudit: !options.agent,
    output: options.output,
    junitReport: options.junit ? options.junitReport : undefined
  });
  reportThresholdFailure(options, result);
}

function reportThresholdFailure(options: ResolvedReporterReportOptions, result: AnalysisResult): void {
  if (!result.thresholdExceeded) {
    return;
  }
  options.stderr.write(
    `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${result.threshold}\n`
  );
  process.exitCode = 2;
}
