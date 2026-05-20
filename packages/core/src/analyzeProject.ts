import { readFile } from "node:fs/promises";
import path from "node:path";

import { COGNITIVE_COMPLEXITY_THRESHOLD, validateThreshold } from "./constants";
import { changedTypeScriptFilesUnderSourceRoots, expandExplicitPaths, findAllTypeScriptFilesUnderSourceRoots } from "./fileSelection";
import { analyzeTypeScriptFiles } from "./parser";
import { resolveSourceExclusionOptions, SourceExclusionAuditBuilder, SourceExclusionMatcher } from "./sourceExclusions";
import { toRelativePath } from "./utils";
import type { AnalysisResult, AnalyzeProjectOptions, MethodMetrics } from "./types";

export async function analyzeProject(options: AnalyzeProjectOptions = {}): Promise<AnalysisResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const threshold = validateThreshold(options.threshold ?? COGNITIVE_COMPLEXITY_THRESHOLD);
  const exclusionOptions = resolveSourceExclusionOptions({
    excludes: options.excludes,
    excludeNames: options.excludeNames,
    excludeDecorators: options.excludeDecorators,
    excludeComments: options.excludeComments,
    useDefaultExclusions: options.useDefaultExclusions
  });
  const exclusionMatcher = new SourceExclusionMatcher(exclusionOptions);
  const audit = new SourceExclusionAuditBuilder();
  const discoveredFiles = await selectFiles(projectRoot, options.explicitPaths ?? [], options.changedOnly ?? false);
  audit.recordDiscoveredFiles(discoveredFiles.length);
  const selectedFiles = await filterSelectedFiles(projectRoot, discoveredFiles, exclusionMatcher, audit);
  if (selectedFiles.length === 0) {
    return emptyAnalysisResult(threshold, audit);
  }

  const parsedFiles = await analyzeTypeScriptFiles(selectedFiles);
  const metrics = parsedFiles.flatMap((parsedFile) => {
    const relativePath = toRelativePath(projectRoot, parsedFile.filePath);
    audit.recordAnalyzedFile();
    return parsedFile.methods.flatMap<MethodMetrics>((method) => {
      const exclusionReason = exclusionMatcher.functionExclusionReason(method);
      if (exclusionReason) {
        audit.recordExcludedFunction(exclusionReason);
        return [];
      }
      audit.recordAnalyzedFunction();
      return [{
        functionName: method.functionName,
        containerName: method.containerName,
        displayName: method.displayName,
        startLine: method.startLine,
        endLine: method.endLine,
        bodySpan: method.bodySpan,
        cognitiveComplexity: method.cognitiveComplexity,
        filePath: parsedFile.filePath,
        relativePath,
        location: `${relativePath}:${method.startLine}-${method.endLine}`
      }];
    });
  });
  const maxCognitiveComplexity = metrics.reduce(
    (max, metric) => Math.max(max, metric.cognitiveComplexity),
    0
  );

  return {
    metrics,
    maxCognitiveComplexity,
    threshold,
    thresholdExceeded: maxCognitiveComplexity > threshold,
    selectedFiles,
    exclusionAudit: audit.build(),
    warnings: []
  };
}

function emptyAnalysisResult(threshold: number, audit: SourceExclusionAuditBuilder): AnalysisResult {
  return {
    metrics: [],
    maxCognitiveComplexity: 0,
    threshold,
    thresholdExceeded: false,
    selectedFiles: [],
    exclusionAudit: audit.build(),
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

async function filterSelectedFiles(
  projectRoot: string,
  selectedFiles: string[],
  exclusionMatcher: SourceExclusionMatcher,
  audit: SourceExclusionAuditBuilder
): Promise<string[]> {
  const remainingFiles: string[] = [];
  for (const filePath of selectedFiles) {
    const relativePath = toRelativePath(projectRoot, filePath);
    const pathExclusionReason = exclusionMatcher.pathExclusionReason(relativePath);
    if (pathExclusionReason) {
      audit.recordExcludedFile(pathExclusionReason);
      continue;
    }

    const commentExclusionReason = exclusionMatcher.usesCommentMarkers()
      ? exclusionMatcher.commentExclusionReason(leadingFileCommentText(await readFile(filePath, "utf8")))
      : null;
    const exclusionReason = commentExclusionReason;
    if (exclusionReason) {
      audit.recordExcludedFile(exclusionReason);
      continue;
    }
    remainingFiles.push(filePath);
  }
  return remainingFiles;
}

function leadingFileCommentText(sourceText: string): string {
  return sourceText
    .match(/^\uFEFF?(?:#![^\n]*\n)?(?:\s|\/\/.*?(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*/u)?.[0]
    ?? "";
}
