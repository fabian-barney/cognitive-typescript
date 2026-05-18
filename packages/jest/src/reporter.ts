import {
  analyzeProject,
  DEFAULT_JUNIT_REPORT,
  deleteOwnedReportFile,
  NO_ANALYZABLE_FUNCTIONS_MESSAGE,
  NO_FILES_MESSAGE,
  publishAnalysisReports,
  resolveReporterReportOptions,
  validateReportPathTargets
} from "@barney-media/cognitive-typescript-core";
import type { ReporterReportOptions, ResolvedReporterReportOptions } from "@barney-media/cognitive-typescript-core";

export interface CognitiveTypescriptJestOptions extends ReporterReportOptions {}

export default class CognitiveTypescriptJestReporter {
  private error: Error | undefined;
  private finalizePromise: Promise<void> | null = null;

  constructor(
    _globalConfig?: unknown,
    private readonly options: CognitiveTypescriptJestOptions = {}
  ) {}

  async onRunComplete(): Promise<void> {
    if (!this.finalizePromise) {
      this.finalizePromise = this.finalize();
    }
    await this.finalizePromise;
  }

  getLastError(): Error | undefined {
    return this.error;
  }

  private async finalize(): Promise<void> {
    const options = resolveReporterOptions(this.options);
    try {
      await validateReportPathTargets(options.projectRoot, [
        { label: "--output", path: options.output },
        { label: "--junit-report", path: options.junit ? options.junitReport : undefined }
      ]);
      if (!options.junit) {
        await deleteOwnedReportFile(options.projectRoot, options.junitReport);
      }

      const result = await analyzeProject({
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
      if (result.thresholdExceeded) {
        options.stderr.write(
          `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${result.threshold}\n`
        );
        process.exitCode = 2;
      }
    } catch (error) {
      this.error = toError(error);
      options.stderr.write(`${this.error.message}\n`);
      process.exitCode = 1;
    }
  }
}

function resolveReporterOptions(options: CognitiveTypescriptJestOptions): ResolvedReporterReportOptions {
  return resolveReporterReportOptions(options, DEFAULT_JUNIT_REPORT);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
