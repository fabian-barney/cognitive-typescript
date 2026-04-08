import type { MethodMetrics } from "./types";

const HEADERS = ["Function", "Cognitive Complexity", "Location"];

export function sortMetrics(metrics: MethodMetrics[]): MethodMetrics[] {
  return [...metrics].sort((left, right) => {
    if (left.cognitiveComplexity !== right.cognitiveComplexity) {
      return right.cognitiveComplexity - left.cognitiveComplexity;
    }
    if (left.relativePath !== right.relativePath) {
      return left.relativePath.localeCompare(right.relativePath);
    }
    return left.startLine - right.startLine;
  });
}

export function formatReport(metrics: MethodMetrics[]): string {
  const rows = sortMetrics(metrics).map((metric) => [
    metric.displayName,
    String(metric.cognitiveComplexity),
    metric.location
  ]);

  const widths = HEADERS.map((header, index) => {
    const rowWidth = rows.reduce((max, row) => Math.max(max, row[index].length), header.length);
    return rowWidth;
  });

  const headerLine = HEADERS.map((header, index) => header.padEnd(widths[index])).join("  ");
  const separator = widths.map((width) => "-".repeat(width)).join("  ");
  const body = rows.map((row) => row.map((value, index) => value.padEnd(widths[index])).join("  "));
  return [headerLine, separator, ...body].join("\n");
}

