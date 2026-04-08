import path from "node:path";

import { COGNITIVE_COMPLEXITY_THRESHOLD } from "./constants";
import { changedTypeScriptFilesUnderSourceRoots, expandExplicitPaths, findAllTypeScriptFilesUnderSourceRoots } from "./fileSelection";
import { analyzeTypeScriptFiles } from "./parser";
import { toRelativePath } from "./utils";
import type { AnalysisResult, AnalyzeProjectOptions, MethodMetrics } from "./types";

export async function analyzeProject(options: AnalyzeProjectOptions = {}): Promise<AnalysisResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const selectedFiles = await selectFiles(projectRoot, options.explicitPaths ?? [], options.changedOnly ?? false);
  if (selectedFiles.length === 0) {
    return emptyAnalysisResult();
  }

  const parsedFiles = await analyzeTypeScriptFiles(selectedFiles);
  const metrics = parsedFiles.flatMap((parsedFile) => {
    const relativePath = toRelativePath(projectRoot, parsedFile.filePath);
    return parsedFile.methods.map<MethodMetrics>((method) => ({
      ...method,
      filePath: parsedFile.filePath,
      relativePath,
      location: `${relativePath}:${method.startLine}-${method.endLine}`
    }));
  });
  const maxCognitiveComplexity = metrics.reduce(
    (max, metric) => Math.max(max, metric.cognitiveComplexity),
    0
  );

  return {
    metrics,
    maxCognitiveComplexity,
    thresholdExceeded: maxCognitiveComplexity > COGNITIVE_COMPLEXITY_THRESHOLD,
    selectedFiles,
    warnings: []
  };
}

function emptyAnalysisResult(): AnalysisResult {
  return {
    metrics: [],
    maxCognitiveComplexity: 0,
    thresholdExceeded: false,
    selectedFiles: [],
    warnings: []
  };
}

async function selectFiles(
  projectRoot: string,
  explicitPaths: string[],
  changedOnly: boolean
): Promise<string[]> {
  if (changedOnly) {
    return changedTypeScriptFilesUnderSourceRoots(projectRoot);
  }
  if (explicitPaths.length > 0) {
    return expandExplicitPaths(projectRoot, explicitPaths);
  }
  return findAllTypeScriptFilesUnderSourceRoots(projectRoot);
}
