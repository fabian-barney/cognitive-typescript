import { XMLBuilder } from "fast-xml-parser";

import { COGNITIVE_COMPLEXITY_THRESHOLD, validateThreshold } from "./constants";
import type { MethodMetrics, ReportFormat, ReportStatus, SourceExclusionAudit } from "./types";

const METHOD_COLUMNS = ["status", "cc", "method", "src", "lineStart", "lineEnd"] as const;
const COMPACT_METHOD_COLUMNS = ["cc", "method", "src", "lineStart", "lineEnd"] as const;
const RIGHT_ALIGNED_TEXT_COLUMNS = new Set<MethodColumn>(["cc", "lineStart", "lineEnd"]);

export interface MethodReportEntry {
  status: ReportStatus;
  cc: number;
  method: string;
  src: string;
  lineStart: number;
  lineEnd: number;
}

export type CompactMethodReportEntry = Omit<MethodReportEntry, "status">;

export interface AnalysisReport {
  status: ReportStatus;
  threshold: number;
  methods: MethodReportEntry[];
  exclusions?: SourceExclusionAudit;
}

export interface CompactAnalysisReport {
  status: ReportStatus;
  threshold: number;
  methods: CompactMethodReportEntry[];
  exclusions?: SourceExclusionAudit;
}

export interface FormatAnalysisReportOptions {
  format: ReportFormat;
  agent?: boolean;
  threshold?: number;
  failuresOnly?: boolean;
  omitRedundancy?: boolean;
  elapsedSeconds?: number;
  exclusionAudit?: SourceExclusionAudit;
  includeExclusionAudit?: boolean;
}

type SerializableReport = AnalysisReport | CompactAnalysisReport;
type ReportValue = string | number;
type ReportFormatter = (report: SerializableReport, omitMethodStatus: boolean, elapsedSeconds: number) => string;
type MethodColumn = (typeof METHOD_COLUMNS)[number];
type CompactMethodColumn = (typeof COMPACT_METHOD_COLUMNS)[number];
type XmlNode = Record<string, unknown>;

const REPORT_FORMATTERS: Record<ReportFormat, ReportFormatter> = {
  toon: formatToonReport,
  json: (report) => `${JSON.stringify(report, null, 2)}\n`,
  text: formatTextReport,
  junit: (report, omitMethodStatus, elapsedSeconds) =>
    formatJunitReport(report as AnalysisReport, omitMethodStatus, elapsedSeconds),
  none: () => ""
};

export function sortMetrics(metrics: MethodMetrics[]): MethodMetrics[] {
  return [...metrics].sort((left, right) => {
    if (left.cognitiveComplexity !== right.cognitiveComplexity) {
      return right.cognitiveComplexity - left.cognitiveComplexity;
    }
    const sourceComparison = compareStable(left.relativePath, right.relativePath);
    if (sourceComparison !== 0) {
      return sourceComparison;
    }
    const methodComparison = compareStable(left.displayName, right.displayName);
    if (methodComparison !== 0) {
      return methodComparison;
    }
    return left.startLine - right.startLine;
  });
}

export function buildAnalysisReport(
  metrics: MethodMetrics[],
  threshold = COGNITIVE_COMPLEXITY_THRESHOLD,
  filterToFailures = false,
  exclusions?: SourceExclusionAudit
): AnalysisReport {
  const validatedThreshold = validateThreshold(threshold);
  const allMethods = sortMetrics(metrics).map((metric) => toMethodReportEntry(metric, validatedThreshold));
  return {
    status: allMethods.some((method) => method.status === "failed") ? "failed" : "passed",
    threshold: validatedThreshold,
    methods: filterToFailures ? allMethods.filter((method) => method.status === "failed") : allMethods,
    ...optionalExclusions(exclusions)
  };
}

export function buildAgentAnalysisReport(
  metrics: MethodMetrics[],
  threshold = COGNITIVE_COMPLEXITY_THRESHOLD,
  exclusions?: SourceExclusionAudit
): CompactAnalysisReport {
  const report = buildAnalysisReport(metrics, threshold, true, exclusions);
  return omitMethodStatuses(report);
}

export function formatAnalysisReport(metrics: MethodMetrics[], options: FormatAnalysisReportOptions): string {
  const prepared = prepareFormatRequest(options);
  if (prepared.format === "none") {
    return "";
  }

  const report = buildAnalysisReport(metrics, prepared.threshold, prepared.failuresOnly, prepared.exclusionAudit);
  const primaryReport = prepared.omitMethodStatus ? omitMethodStatuses(report) : report;
  return REPORT_FORMATTERS[prepared.format](primaryReport, prepared.omitRedundancy, prepared.elapsedSeconds);
}

interface PreparedFormatRequest {
  elapsedSeconds: number;
  failuresOnly: boolean;
  format: ReportFormat;
  omitMethodStatus: boolean;
  omitRedundancy: boolean;
  threshold: number;
  exclusionAudit?: SourceExclusionAudit;
}

function prepareFormatRequest(options: FormatAnalysisReportOptions): PreparedFormatRequest {
  const format = options.format;
  const agent = options.agent ?? false;
  const omitRedundancy = options.omitRedundancy ?? agent;
  return {
    format,
    threshold: validateThreshold(options.threshold ?? COGNITIVE_COMPLEXITY_THRESHOLD),
    failuresOnly: options.failuresOnly ?? agent,
    omitRedundancy,
    omitMethodStatus: omitRedundancy && format !== "junit",
    elapsedSeconds: options.elapsedSeconds ?? 0,
    exclusionAudit: options.includeExclusionAudit === false ? undefined : options.exclusionAudit
  };
}

export function formatReport(metrics: MethodMetrics[]): string {
  return formatTextReport(buildAnalysisReport(metrics), false);
}

export function formatToonReport(report: SerializableReport, omitMethodStatus = false): string {
  const toonReport = omitMethodStatus && reportHasMethodStatus(report) ? omitMethodStatuses(report) : report;
  return encodeToonReport(toonReport);
}

export function formatTextReport(report: SerializableReport, omitMethodStatus = false): string {
  const summary = [`status: ${report.status}`, `threshold: ${report.threshold}`];
  if (report.methods.length === 0) {
    return [...summary, "methods[0]:", ...exclusionTextLines(report.exclusions, false)].join("\n") + "\n";
  }

  const includeStatus = !omitMethodStatus && reportHasMethodStatus(report);
  const columns = includeStatus ? METHOD_COLUMNS : COMPACT_METHOD_COLUMNS;
  const rows = includeStatus
    ? report.methods.map((method) =>
        METHOD_COLUMNS.map((column) => formatTextValue(readMethodColumnValue(method, column)))
      )
    : (report as CompactAnalysisReport).methods.map((method) =>
        COMPACT_METHOD_COLUMNS.map((column) => formatTextValue(readMethodColumnValue(method, column)))
      );
  const widths = columns.map((column, index) =>
    rows.reduce((max, row) => Math.max(max, readIndexedValue(row, index).length), column.length)
  );
  const headerLine = formatTextRow([...columns], widths, columns);
  const separator = formatTextSeparator(widths);
  const body = rows.map((row) => formatTextRow(row, widths, columns));

  return [...summary, "", headerLine, separator, ...body, ...exclusionTextLines(report.exclusions)].join("\n") + "\n";
}

export function formatJunitReport(report: AnalysisReport, omitRedundancy = false, elapsedSeconds = 0): string {
  return `${formatXmlDeclaration()}\n${createXmlBuilder()
    .build(toJunitXml(report, omitRedundancy, elapsedSeconds))
    .trimEnd()}\n`;
}

function toMethodReportEntry(metric: MethodMetrics, threshold: number): MethodReportEntry {
  return {
    status: metric.cognitiveComplexity > threshold ? "failed" : "passed",
    cc: metric.cognitiveComplexity,
    method: metric.displayName,
    src: metric.relativePath,
    lineStart: metric.startLine,
    lineEnd: metric.endLine
  };
}

function reportHasMethodStatus(report: SerializableReport): report is AnalysisReport {
  return report.methods.length === 0 || report.methods.every((method) => "status" in method);
}

function omitMethodStatuses(report: AnalysisReport): CompactAnalysisReport {
  return {
    status: report.status,
    threshold: report.threshold,
    methods: report.methods.map((method) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit status from compact report entries
      const { status: _status, ...compactMethod } = method;
      return compactMethod;
    }),
    ...optionalExclusions(report.exclusions)
  };
}

function optionalExclusions(exclusions: SourceExclusionAudit | undefined): { exclusions?: SourceExclusionAudit } {
  return exclusions ? { exclusions } : {};
}

function compareStable(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function formatTextValue(value: ReportValue): string {
  return String(value);
}

function formatTextRow(
  values: string[],
  widths: number[],
  columns: readonly (MethodColumn | CompactMethodColumn)[] = METHOD_COLUMNS
): string {
  return `| ${values.map((value, index) => formatTextCell(value, readIndexedValue(widths, index), readIndexedValue(columns, index))).join(" | ")} |`;
}

function formatTextCell(value: string, width: number, column: MethodColumn | CompactMethodColumn): string {
  return RIGHT_ALIGNED_TEXT_COLUMNS.has(column as MethodColumn) ? value.padStart(width) : value.padEnd(width);
}

function formatTextSeparator(widths: number[]): string {
  return `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;
}

function encodeToonReport(report: SerializableReport): string {
  const columns = reportHasMethodStatus(report) ? METHOD_COLUMNS : COMPACT_METHOD_COLUMNS;
  const rows = report.methods.map((method) =>
    columns.map((column) => toonValue(readMethodColumnValue(method, column))).join(",")
  );
  return (
    [
      `status: ${report.status}`,
      `threshold: ${report.threshold}`,
      `methods[${report.methods.length}]${report.methods.length === 0 ? "" : `{${columns.join(",")}}`}:`,
      ...rows.map((row) => `  ${row}`),
      ...toonExclusionLines(report.exclusions)
    ].join("\n") + "\n"
  );
}

function toonValue(value: ReportValue): string {
  const text = String(value);
  return /[",\n]/.test(text) ? JSON.stringify(text) : text;
}

function methodProperties(entry: MethodReportEntry, omitRedundancy: boolean): Array<[string, string]> {
  const properties: Array<[string, string]> = [
    ["cc", String(entry.cc)],
    ["method", entry.method],
    ["src", entry.src],
    ["lineStart", String(entry.lineStart)],
    ["lineEnd", String(entry.lineEnd)]
  ];
  return omitRedundancy ? properties : [["status", entry.status], ...properties];
}

function formatXmlDeclaration(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>';
}

function createXmlBuilder(): XMLBuilder {
  return new XMLBuilder({
    attributeNamePrefix: "@_",
    format: true,
    ignoreAttributes: false,
    suppressEmptyNode: true
  });
}

function toJunitXml(report: AnalysisReport, omitRedundancy: boolean, elapsedSeconds: number): XmlNode {
  const failures = report.methods.filter((method) => method.status === "failed").length;
  const time = formatTime(elapsedSeconds);
  const testcaseTime = formatTime(report.methods.length === 0 ? 0 : elapsedSeconds / report.methods.length);
  const testsuite: XmlNode = {
    "@_name": "cognitive-typescript",
    "@_status": report.status,
    "@_tests": report.methods.length,
    "@_failures": failures,
    "@_skipped": 0,
    "@_errors": 0,
    "@_time": time,
    properties: {
      property: junitProperties(report)
    }
  };

  if (report.methods.length > 0) {
    testsuite.testcase = report.methods.map((method) =>
      toJunitTestcaseXml(method, report.threshold, omitRedundancy, testcaseTime)
    );
  }

  return {
    testsuites: {
      "@_name": "cognitive-typescript",
      "@_tests": report.methods.length,
      "@_failures": failures,
      "@_skipped": 0,
      "@_errors": 0,
      "@_time": time,
      testsuite
    }
  };
}

function toJunitTestcaseXml(
  entry: MethodReportEntry,
  threshold: number,
  omitRedundancy: boolean,
  time: string
): XmlNode {
  return {
    "@_classname": entry.src,
    "@_name": junitTestcaseName(entry),
    "@_file": entry.src,
    "@_time": time,
    "@_line": entry.lineStart,
    properties: {
      property: methodProperties(entry, omitRedundancy).map(([name, value]) => toXmlProperty(name, value))
    },
    ...junitStatusXml(entry, threshold)
  };
}

function junitTestcaseName(entry: MethodReportEntry): string {
  return `${entry.method}:${entry.lineStart}`;
}

function toXmlProperty(name: string, value: string): XmlNode {
  return {
    "@_name": name,
    "@_value": value
  };
}

function junitProperties(report: AnalysisReport): XmlNode[] {
  const properties = [toXmlProperty("threshold", String(report.threshold))];
  if (report.exclusions) {
    properties.push(
      toXmlProperty("exclusion.discoveredFiles", String(report.exclusions.discoveredFiles)),
      toXmlProperty("exclusion.analyzedFiles", String(report.exclusions.analyzedFiles)),
      toXmlProperty("exclusion.analyzedFunctions", String(report.exclusions.analyzedFunctions)),
      toXmlProperty("exclusion.excludedFiles", String(report.exclusions.excludedFiles)),
      toXmlProperty("exclusion.excludedFunctions", String(report.exclusions.excludedFunctions))
    );
    for (const count of report.exclusions.excludedFileReasons) {
      properties.push(toXmlProperty(`exclusion.file.${sanitizePropertyName(count.reason)}`, String(count.count)));
    }
    for (const count of report.exclusions.excludedFunctionReasons) {
      properties.push(toXmlProperty(`exclusion.function.${sanitizePropertyName(count.reason)}`, String(count.count)));
    }
  }
  return properties;
}

function junitStatusXml(entry: MethodReportEntry, threshold: number): XmlNode {
  if (entry.status !== "failed") {
    return {};
  }
  const message = `Cognitive Complexity threshold exceeded: ${entry.cc} > ${threshold}`;
  return {
    failure: {
      "@_type": "cognitive-typescript.threshold",
      "@_message": message,
      "#text": junitDiagnosticText(entry, threshold)
    }
  };
}

function junitDiagnosticText(entry: MethodReportEntry, threshold: number): string {
  return [
    `Cognitive Complexity: ${entry.cc}`,
    `Threshold: ${threshold}`,
    `Source: ${entry.src}:${entry.lineStart}-${entry.lineEnd}`,
    `Method: ${entry.method}`
  ].join("\n");
}

function formatTime(elapsedSeconds: number): string {
  if (elapsedSeconds <= 0) {
    return "0.000000";
  }
  return Math.max(elapsedSeconds, 1e-6).toFixed(6);
}

function exclusionTextLines(exclusions: SourceExclusionAudit | undefined, leadingBlankLine = true): string[] {
  if (!exclusions) {
    return [];
  }
  const lines = exclusionLines(exclusions);
  return leadingBlankLine ? ["", ...lines] : lines;
}

function toonExclusionLines(exclusions: SourceExclusionAudit | undefined): string[] {
  return exclusions ? exclusionLines(exclusions) : [];
}

function exclusionLines(exclusions: SourceExclusionAudit): string[] {
  const lines = [
    "exclusions:",
    `  discoveredFiles: ${exclusions.discoveredFiles}`,
    `  analyzedFiles: ${exclusions.analyzedFiles}`,
    `  analyzedFunctions: ${exclusions.analyzedFunctions}`,
    `  excludedFiles: ${exclusions.excludedFiles}`,
    `  excludedFunctions: ${exclusions.excludedFunctions}`
  ];
  appendExclusionReasonLines(lines, "file", exclusions.excludedFileReasons);
  appendExclusionReasonLines(lines, "function", exclusions.excludedFunctionReasons);
  return lines;
}

function appendExclusionReasonLines(
  lines: string[],
  prefix: "file" | "function",
  counts: SourceExclusionAudit["excludedFileReasons"] | SourceExclusionAudit["excludedFunctionReasons"]
): void {
  for (const count of counts) {
    lines.push(`  ${prefix}.${count.reason}: ${count.count}`);
  }
}

function sanitizePropertyName(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}

function readMethodColumnValue(
  method: MethodReportEntry | CompactMethodReportEntry,
  column: MethodColumn | CompactMethodColumn
): ReportValue {
  switch (column) {
    case "status":
      return (method as MethodReportEntry).status;
    case "cc":
      return method.cc;
    case "method":
      return method.method;
    case "src":
      return method.src;
    case "lineStart":
      return method.lineStart;
    case "lineEnd":
      return method.lineEnd;
  }
}

function readIndexedValue<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error("Internal report formatting error: inconsistent table state");
  }
  return value;
}
