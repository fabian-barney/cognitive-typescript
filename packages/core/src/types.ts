export type CliMode = "all" | "changed" | "explicit" | "help";

export interface SourceSpan {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface Writer {
  write(chunk: string): unknown;
}

export interface CliArguments {
  mode: CliMode;
  fileArgs: string[];
}

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
  stdout?: Writer;
  stderr?: Writer;
}

export interface AnalysisResult {
  metrics: MethodMetrics[];
  maxCognitiveComplexity: number;
  thresholdExceeded: boolean;
  selectedFiles: string[];
  warnings: string[];
}
