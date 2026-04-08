import ts from "typescript";

import { analyzeFunctionBody, isNestedFunctionLike } from "./cognitiveComplexity";
import type { InternalMethod, NamedFunctionLike } from "./analysisModel";
import type { SourceSpan } from "./types";
import { normalizeSlashes } from "./utils";

export function collectMethodsFromSourceFile(sourceFile: ts.SourceFile, checker: ts.TypeChecker): InternalMethod[] {
  const methods: InternalMethod[] = [];

  const visit = (node: ts.Node): void => {
    const method = buildInternalMethod(node, sourceFile, checker);
    if (method) {
      methods.push(method);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return methods;
}

function buildInternalMethod(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): InternalMethod | null {
  for (const builder of METHOD_BUILDERS) {
    const candidate = builder(node, sourceFile, checker);
    if (candidate) {
      return shouldIgnoreDeclarativeOuterFunction(node, candidate) ? null : candidate;
    }
  }
  return null;
}

type MethodBuilder = (
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
) => InternalMethod | null;

const METHOD_BUILDERS: MethodBuilder[] = [
  buildFunctionDeclarationMethod,
  buildConstructorMethod,
  buildMethodDeclarationMethod,
  buildAccessorMethod,
  buildAssignedFunctionMethod
];

function buildFunctionDeclarationMethod(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): InternalMethod | null {
  if (!ts.isFunctionDeclaration(node) || !node.body) {
    return null;
  }
  const functionName = node.name?.text ?? inferAnonymousDefaultName(node);
  if (!functionName) {
    return null;
  }
  return createInternalMethod({
    functionNode: node,
    sourceFile,
    checker,
    functionName,
    containerName: findContainerName(node),
    symbolNodes: node.name ? [node.name] : []
  });
}

function buildConstructorMethod(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): InternalMethod | null {
  if (!ts.isConstructorDeclaration(node) || !node.body) {
    return null;
  }
  const containerName = findContainerName(node);
  if (!containerName) {
    return null;
  }
  return createInternalMethod({
    functionNode: node,
    sourceFile,
    checker,
    functionName: "constructor",
    containerName,
    symbolNodes: []
  });
}

function buildMethodDeclarationMethod(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): InternalMethod | null {
  if (!ts.isMethodDeclaration(node) || !node.body) {
    return null;
  }
  return createInternalMethod({
    functionNode: node,
    sourceFile,
    checker,
    functionName: propertyName(node.name),
    containerName: findContainerName(node),
    symbolNodes: [node.name]
  });
}

function buildAccessorMethod(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): InternalMethod | null {
  if (!(ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) || !node.body) {
    return null;
  }
  return createInternalMethod({
    functionNode: node,
    sourceFile,
    checker,
    functionName: `${ts.isGetAccessorDeclaration(node) ? "get" : "set"} ${propertyName(node.name)}`,
    containerName: findContainerName(node),
    symbolNodes: [node.name]
  });
}

function buildAssignedFunctionMethod(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): InternalMethod | null {
  if (!(ts.isFunctionExpression(node) || ts.isArrowFunction(node))) {
    return null;
  }
  const assignment = findAssignedFunctionName(node);
  if (!assignment) {
    return null;
  }

  const symbolNodes = [...assignment.symbolNodes];
  if (ts.isFunctionExpression(node) && node.name) {
    symbolNodes.push(node.name);
  }

  return createInternalMethod({
    functionNode: node,
    sourceFile,
    checker,
    functionName: assignment.name,
    containerName: assignment.containerName,
    symbolNodes,
    fallbackOwnerName: assignment.fallbackOwnerName,
    fallbackNames: assignment.fallbackNames
  });
}

function createInternalMethod({
  functionNode,
  sourceFile,
  checker,
  functionName,
  containerName,
  symbolNodes,
  fallbackOwnerName,
  fallbackNames
}: {
  functionNode: NamedFunctionLike;
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
  functionName: string;
  containerName: string | null;
  symbolNodes: ts.Node[];
  fallbackOwnerName?: string | null;
  fallbackNames?: string[];
}): InternalMethod {
  const body = functionNode.body!;
  const bodySpan = toSourceSpan(body, sourceFile);
  const startLine = sourceFile.getLineAndCharacterOfPosition(functionNode.getStart(sourceFile)).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(Math.max(body.end - 1, body.getStart(sourceFile))).line + 1;
  const analysis = analyzeFunctionBody(functionNode, sourceFile, checker, containerName);

  return {
    id: `${normalizeFilePath(sourceFile.fileName)}:${startLine}:${functionName}`,
    filePath: normalizeFilePath(sourceFile.fileName),
    functionName,
    containerName,
    displayName: toDisplayName(containerName, functionName),
    startLine,
    endLine,
    bodySpan,
    parameterCount: functionNode.parameters.length,
    baseCognitiveComplexity: analysis.cognitiveComplexity,
    symbols: collectSymbols(symbolNodes, checker),
    fallbackNames: uniqueStrings([functionName, ...(fallbackNames ?? [])]),
    fallbackOwnerName: fallbackOwnerName ?? containerName,
    calls: analysis.calls
  };
}

function collectSymbols(nodes: ts.Node[], checker: ts.TypeChecker): ts.Symbol[] {
  const symbols = new Set<ts.Symbol>();
  for (const node of nodes) {
    const symbol = resolveSymbol(node, checker);
    if (symbol) {
      symbols.add(symbol);
    }
  }
  return Array.from(symbols);
}

function resolveSymbol(node: ts.Node, checker: ts.TypeChecker): ts.Symbol | null {
  const rawSymbol = checker.getSymbolAtLocation(node);
  if (!rawSymbol) {
    return null;
  }
  if (rawSymbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(rawSymbol);
  }
  return rawSymbol;
}

function shouldIgnoreDeclarativeOuterFunction(node: ts.Node, method: InternalMethod): boolean {
  if (method.baseCognitiveComplexity !== 0) {
    return false;
  }
  if (!(ts.isFunctionExpression(node) || ts.isArrowFunction(node))) {
    return false;
  }
  if (!ts.isBlock(node.body)) {
    return false;
  }
  if (hasEnclosingFunction(node)) {
    return false;
  }
  if (!hasDeclarativeMethodLikeTopLevel(node.body.statements)) {
    return false;
  }
  return node.body.statements.every(isDeclarativeTopLevelStatement);
}

function hasEnclosingFunction(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (isNestedFunctionLike(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function hasDeclarativeMethodLikeTopLevel(statements: readonly ts.Statement[]): boolean {
  return statements.some((statement) => statementContainsDeclarativeMethodLike(statement));
}

function statementContainsDeclarativeMethodLike(statement: ts.Statement): boolean {
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return true;
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some((declaration) =>
      declaration.initializer ? initializerContainsMethodLike(declaration.initializer) : false
    );
  }
  if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)) {
    return initializerContainsMethodLike(statement.expression.right);
  }
  return false;
}

function initializerContainsMethodLike(expression: ts.Expression): boolean {
  const unwrapped = unwrapParentheses(expression);
  if (ts.isFunctionExpression(unwrapped) || ts.isArrowFunction(unwrapped) || ts.isClassExpression(unwrapped)) {
    return true;
  }
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return unwrapped.properties.some((property) =>
      ts.isMethodDeclaration(property)
      || (ts.isPropertyAssignment(property) && initializerContainsMethodLike(property.initializer))
    );
  }
  return false;
}

function isDeclarativeTopLevelStatement(statement: ts.Statement): boolean {
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isVariableStatement(statement) ||
    ts.isEmptyStatement(statement)
  ) {
    return true;
  }
  return ts.isExpressionStatement(statement)
    && ts.isBinaryExpression(statement.expression)
    && statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    && initializerContainsMethodLike(statement.expression.right);
}

function inferAnonymousDefaultName(node: ts.FunctionDeclaration): string | null {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ? "default" : null;
}

function findAssignedFunctionName(
  node: ts.FunctionExpression | ts.ArrowFunction
): {
  name: string;
  containerName: string | null;
  symbolNodes: ts.Node[];
  fallbackOwnerName: string | null;
  fallbackNames: string[];
} | null {
  const parent = node.parent;
  for (const resolver of ASSIGNED_FUNCTION_NAME_RESOLVERS) {
    const assignment = resolver(parent, node);
    if (assignment) {
      return assignment;
    }
  }
  return null;
}

type AssignedFunctionNameResolver = (
  parent: ts.Node,
  node: ts.FunctionExpression | ts.ArrowFunction
) => {
  name: string;
  containerName: string | null;
  symbolNodes: ts.Node[];
  fallbackOwnerName: string | null;
  fallbackNames: string[];
} | null;

const ASSIGNED_FUNCTION_NAME_RESOLVERS: AssignedFunctionNameResolver[] = [
  assignedNameFromVariableDeclaration,
  assignedNameFromPropertyAssignment,
  assignedNameFromPropertyDeclaration,
  assignedNameFromBinaryExpression
];

function assignedNameFromVariableDeclaration(parent: ts.Node): ReturnType<AssignedFunctionNameResolver> {
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    const containerName = findContainerName(parent);
    return {
      name: parent.name.text,
      containerName,
      symbolNodes: [parent.name],
      fallbackOwnerName: containerName,
      fallbackNames: [parent.name.text]
    };
  }
  return null;
}

function assignedNameFromPropertyAssignment(parent: ts.Node): ReturnType<AssignedFunctionNameResolver> {
  if (ts.isPropertyAssignment(parent)) {
    const name = propertyName(parent.name);
    const containerName = inferObjectContainerName(parent.parent);
    return {
      name,
      containerName,
      symbolNodes: [parent.name],
      fallbackOwnerName: containerName,
      fallbackNames: [name]
    };
  }
  return null;
}

function assignedNameFromPropertyDeclaration(parent: ts.Node): ReturnType<AssignedFunctionNameResolver> {
  if (ts.isPropertyDeclaration(parent)) {
    const name = propertyName(parent.name);
    const containerName = findContainerName(parent);
    return {
      name,
      containerName,
      symbolNodes: [parent.name],
      fallbackOwnerName: containerName,
      fallbackNames: [name]
    };
  }
  return null;
}

function assignedNameFromBinaryExpression(
  parent: ts.Node,
  node: ts.FunctionExpression | ts.ArrowFunction
): ReturnType<AssignedFunctionNameResolver> {
  if (!(ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === node)) {
    return null;
  }
  const target = assignmentTarget(parent.left);
  return {
    name: target.name,
    containerName: target.containerName,
    symbolNodes: [],
    fallbackOwnerName: target.containerName,
    fallbackNames: [target.name]
  };
}

function findContainerName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if ((ts.isClassDeclaration(current) || ts.isClassExpression(current)) && current.name) {
      return current.name.text;
    }
    if (ts.isObjectLiteralExpression(current)) {
      const inferred = inferObjectContainerName(current);
      if (inferred) {
        return inferred;
      }
    }
    current = current.parent;
  }
  return null;
}

function inferObjectContainerName(node: ts.ObjectLiteralExpression): string | null {
  for (const resolver of OBJECT_CONTAINER_RESOLVERS) {
    const containerName = resolver(node.parent);
    if (containerName) {
      return containerName;
    }
  }
  return null;
}

type ObjectContainerResolver = (parent: ts.Node) => string | null;

const OBJECT_CONTAINER_RESOLVERS: ObjectContainerResolver[] = [
  containerFromVariableDeclaration,
  containerFromPropertyAssignment,
  containerFromPropertyDeclaration,
  containerFromBinaryAssignment
];

function containerFromVariableDeclaration(parent: ts.Node): string | null {
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return null;
}

function containerFromPropertyAssignment(parent: ts.Node): string | null {
  if (ts.isPropertyAssignment(parent)) {
    return propertyName(parent.name);
  }
  return null;
}

function containerFromPropertyDeclaration(parent: ts.Node): string | null {
  if (ts.isPropertyDeclaration(parent)) {
    return propertyName(parent.name);
  }
  return null;
}

function containerFromBinaryAssignment(parent: ts.Node): string | null {
  if (!ts.isBinaryExpression(parent) || parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
    return null;
  }
  const target = assignmentTarget(parent.left);
  return toDisplayName(target.containerName, target.name);
}

function assignmentTarget(node: ts.Expression): { name: string; containerName: string | null } {
  if (ts.isIdentifier(node)) {
    return {
      name: node.text,
      containerName: null
    };
  }
  if (ts.isPropertyAccessExpression(node)) {
    return {
      name: node.name.text,
      containerName: node.expression.getText()
    };
  }
  if (ts.isElementAccessExpression(node)) {
    return {
      name: `[${node.argumentExpression?.getText() ?? ""}]`,
      containerName: node.expression.getText()
    };
  }
  return {
    name: "<assigned>",
    containerName: null
  };
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isPrivateIdentifier(name)) {
    return name.getText();
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText();
}

function toDisplayName(containerName: string | null, functionName: string): string {
  if (!containerName) {
    return functionName;
  }
  return functionName.startsWith("[") ? `${containerName}${functionName}` : `${containerName}.${functionName}`;
}

function toSourceSpan(node: ts.Node, sourceFile: ts.SourceFile): SourceSpan {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.end);
  return {
    startLine: start.line + 1,
    startColumn: start.character,
    endLine: end.line + 1,
    endColumn: end.character
  };
}

function unwrapParentheses<T extends ts.Node>(node: T): T {
  let current: ts.Node = node;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current as T;
}

function normalizeFilePath(filePath: string): string {
  return normalizeSlashes(filePath);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
