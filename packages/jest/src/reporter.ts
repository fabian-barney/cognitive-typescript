import path from "node:path";

import {
  analyzeProject,
  deleteOwnedReportFile,
  NO_ANALYZABLE_FUNCTIONS_MESSAGE,
  NO_FILES_MESSAGE,
  publishAnalysisReports,
  resolveReporterReportOptions,
  validateReportPathTargets
} from "@barney-media/cognitive-typescript-core";
import type { ReportFormat, ResolvedReporterReportOptions, Writer } from "@barney-media/cognitive-typescript-core";

export interface CognitiveTypescriptJestOptions {
  projectRoot?: string;
  changedOnly?: boolean;
  paths?: string[];
  format?: ReportFormat;
  agent?: boolean;
  failuresOnly?: boolean;
  omitRedundancy?: boolean;
  output?: string;
  junit?: boolean;
  junitReport?: string;
  threshold?: number;
  stdout?: Writer;
  stderr?: Writer;
}

const DEFAULT_JUNIT_REPORT = path.join("reports", "cognitive-typescript", "TEST-cognitive-typescript.xml");

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
        { label: "--junit-report", path: options.junitReport }
      ]);
      if (!options.junit) {
        await deleteOwnedReportFile(options.projectRoot, options.junitReport);
      }

      const result = await analyzeProject({
        projectRoot: options.projectRoot,
        explicitPaths: options.paths,
        changedOnly: options.changedOnly,
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
        failuresOnly: options.failuresOnly,
        omitRedundancy: options.omitRedundancy,
        output: options.output,
        junitReport: options.junit ? options.junitReport : undefined
      });
      if (result.thresholdExceeded) {
        const thresholdError = new Error(
          `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${result.threshold}`
        );
        options.stderr.write(`${thresholdError.message}\n`);
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
