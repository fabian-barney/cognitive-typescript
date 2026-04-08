import {
  analyzeProject,
  COGNITIVE_COMPLEXITY_THRESHOLD,
  formatReport,
  NO_ANALYZABLE_FUNCTIONS_MESSAGE,
  NO_FILES_MESSAGE
} from "@barney-media/cognitive-typescript-core";
import type { Writer } from "@barney-media/cognitive-typescript-core";

export interface CognitiveTypescriptJestOptions {
  projectRoot?: string;
  changedOnly?: boolean;
  paths?: string[];
  stdout?: Writer;
  stderr?: Writer;
}

interface ResolvedReporterOptions {
  projectRoot: string;
  paths: string[];
  changedOnly: boolean;
  stdout: Writer;
  stderr: Writer;
}

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
      const result = await analyzeProject({
        projectRoot: options.projectRoot,
        explicitPaths: options.paths,
        changedOnly: options.changedOnly
      });

      if (result.selectedFiles.length === 0) {
        options.stdout.write(`${NO_FILES_MESSAGE}\n`);
        return;
      }
      if (result.metrics.length === 0) {
        options.stdout.write(`${NO_ANALYZABLE_FUNCTIONS_MESSAGE}\n`);
        return;
      }

      options.stdout.write(`${formatReport(result.metrics)}\n`);
      if (result.thresholdExceeded) {
        this.error = new Error(
          `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${COGNITIVE_COMPLEXITY_THRESHOLD}`
        );
        options.stderr.write(`${this.error.message}\n`);
        process.exitCode = 1;
      }
    } catch (error) {
      this.error = toError(error);
      options.stderr.write(`${this.error.message}\n`);
      process.exitCode = 1;
    }
  }
}

function resolveReporterOptions(options: CognitiveTypescriptJestOptions): ResolvedReporterOptions {
  return {
    projectRoot: options.projectRoot ?? process.cwd(),
    paths: options.paths ?? [],
    changedOnly: options.changedOnly ?? false,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
