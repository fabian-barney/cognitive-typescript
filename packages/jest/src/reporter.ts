import {
  DEFAULT_JUNIT_REPORT,
  resolveReporterReportOptions,
  runReporterAnalysis
} from "@barney-media/cognitive-typescript-core";
import type { ReporterReportOptions, ResolvedReporterReportOptions } from "@barney-media/cognitive-typescript-core";

// Preserve the exported interface shape for downstream declaration merging.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
      await runReporterAnalysis(options);
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
