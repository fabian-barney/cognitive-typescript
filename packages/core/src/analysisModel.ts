import type ts from "typescript";

import type { MethodDescriptor, SourceSpan } from "./types";

export interface ParsedMethodDescriptor extends MethodDescriptor {
  exclusionNames: string[];
  decoratorNames: string[];
  leadingCommentText: string;
}

export interface ParsedFileMethods {
  filePath: string;
  fileLeadingCommentText: string;
  methods: ParsedMethodDescriptor[];
}

export interface InternalMethod {
  id: string;
  filePath: string;
  functionName: string;
  containerName: string | null;
  displayName: string;
  startLine: number;
  endLine: number;
  bodySpan: SourceSpan;
  parameterCount: number;
  baseCognitiveComplexity: number;
  symbols: ts.Symbol[];
  fallbackNames: string[];
  fallbackOwnerName: string | null;
  exclusionNames: string[];
  decoratorNames: string[];
  leadingCommentText: string;
  calls: CallTarget[];
}

export interface CallTarget {
  symbol: ts.Symbol | null;
  name: string | null;
  ownerName: string | null;
  arity: number;
}

export type NamedFunctionLike =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration
  | ts.ConstructorDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction;

export type LogicalOperator = "&&" | "||" | null;
