export type CliMode = "all" | "changed" | "explicit" | "help";
export type ReportFormat = "toon" | "json" | "text" | "junit" | "none";
export type ReportStatus = "passed" | "failed";

export interface SourceSpan {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface Writer {
  write(chunk: string): unknown;
}

export interface HelpCliArguments {
  mode: "help";
  fileArgs: string[];
}

export interface AnalysisCliArguments {
  mode: Exclude<CliMode, "help">;
  fileArgs: string[];
  format: ReportFormat;
  threshold: number;
  agent: boolean;
  failuresOnly: boolean;
  omitRedundancy: boolean;
  excludes: string[];
  excludeNames: string[];
  excludeDecorators: string[];
  excludeComments: string[];
  useDefaultExclusions: boolean;
  output?: string;
  junitReport?: string;
}

export type CliArguments = HelpCliArguments | AnalysisCliArguments;

export interface MethodDescriptor {
  functionName: string;
  containerName: string | null;
  displayName: string;
  startLine: number;
  endLine: number;
  bodySpan: SourceSpan;
  cognitiveComplexity: number;
}

export interface MethodMetrics extends MethodDescriptor {
  filePath: string;
  relativePath: string;
  location: string;
}

export interface AnalyzeProjectOptions {
  projectRoot?: string;
  explicitPaths?: string[];
  changedOnly?: boolean;
  excludes?: string[];
  excludeNames?: string[];
  excludeDecorators?: string[];
  excludeComments?: string[];
  useDefaultExclusions?: boolean;
  threshold?: number;
  stdout?: Writer;
  stderr?: Writer;
}

export interface SourceExclusionAuditCount {
  reason: string;
  count: number;
}

export interface SourceExclusionAudit {
  discoveredFiles: number;
  analyzedFiles: number;
  analyzedFunctions: number;
  excludedFiles: number;
  excludedFunctions: number;
  excludedFileReasons: SourceExclusionAuditCount[];
  excludedFunctionReasons: SourceExclusionAuditCount[];
}

export interface AnalysisResult {
  metrics: MethodMetrics[];
  maxCognitiveComplexity: number;
  threshold: number;
  thresholdExceeded: boolean;
  selectedFiles: string[];
  exclusionAudit: SourceExclusionAudit;
  warnings: string[];
}

export interface PublishAnalysisReportsOptions {
  projectRoot: string;
  stdout: Writer;
  metrics: MethodMetrics[];
  format: ReportFormat;
  threshold: number;
  exclusionAudit?: SourceExclusionAudit;
  agent?: boolean;
  failuresOnly?: boolean;
  omitRedundancy?: boolean;
  includePrimaryExclusionAudit?: boolean;
  output?: string;
  junitReport?: string;
  elapsedSeconds?: number;
}

export interface ReporterReportOptions {
  projectRoot?: string;
  changedOnly?: boolean;
  paths?: string[];
  excludes?: string[];
  excludeNames?: string[];
  excludeDecorators?: string[];
  excludeComments?: string[];
  useDefaultExclusions?: boolean;
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

export interface ResolvedReporterReportOptions {
  projectRoot: string;
  paths: string[];
  changedOnly: boolean;
  excludes: string[];
  excludeNames: string[];
  excludeDecorators: string[];
  excludeComments: string[];
  useDefaultExclusions: boolean;
  format: ReportFormat;
  agent: boolean;
  failuresOnly: boolean | undefined;
  omitRedundancy: boolean | undefined;
  output: string | undefined;
  junit: boolean;
  junitReport: string;
  threshold: number;
  stdout: Writer;
  stderr: Writer;
}
