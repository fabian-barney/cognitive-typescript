import ts from "typescript";

import type { CallTarget, LogicalOperator, NamedFunctionLike } from "./analysisModel";

export function analyzeFunctionBody(
  root: NamedFunctionLike,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  containerName: string | null
): { cognitiveComplexity: number; calls: CallTarget[] } {
  let cognitiveComplexity = 0;
  const calls: CallTarget[] = [];

  const addStructural = (nesting: number): void => {
    cognitiveComplexity += 1 + nesting;
  };
  const addHybrid = (): void => {
    cognitiveComplexity += 1;
  };
  const addFundamental = (): void => {
    cognitiveComplexity += 1;
  };

  const scanNodes = (nodes: readonly ts.Node[] | undefined, nesting: number): void => {
    nodes?.forEach((node) => {
      scan(node, nesting);
    });
  };

  const scanElseBranch = (elseStatement: ts.Statement | undefined, nesting: number): void => {
    if (!elseStatement) {
      return;
    }
    if (ts.isIfStatement(elseStatement)) {
      scan(elseStatement, nesting);
      return;
    }
    addHybrid();
    scan(elseStatement, nesting + 1);
  };

  const scanLogicalExpression = (node: ts.Expression, nesting: number, previousOperator: LogicalOperator): void => {
    const expression = unwrapParentheses(node);
    if (scanNegatedLogicalExpression(expression, nesting)) {
      return;
    }
    if (scanLogicalBinaryExpression(expression, nesting, previousOperator)) {
      return;
    }
    scan(expression, nesting);
  };

  const recordCall = (expression: ts.Expression, arity: number): void => {
    calls.push({
      symbol: resolveCallSymbol(expression, checker),
      ...fallbackCallTarget(expression, sourceFile, containerName),
      arity
    });
  };

  const handleIfStatement = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isIfStatement(node)) {
      return false;
    }
    if (ts.isIfStatement(node.parent) && node.parent.elseStatement === node) {
      addHybrid();
    } else {
      addStructural(nesting);
    }
    scan(node.expression, nesting);
    scan(node.thenStatement, nesting + 1);
    scanElseBranch(node.elseStatement, nesting);
    return true;
  };

  const handleForStatement = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isForStatement(node)) {
      return false;
    }
    addStructural(nesting);
    scanNodes(node.initializer ? [node.initializer] : undefined, nesting);
    scan(node.condition, nesting);
    scanNodes(node.incrementor ? [node.incrementor] : undefined, nesting);
    scan(node.statement, nesting + 1);
    return true;
  };

  const handleForEachStatement = (node: ts.Node, nesting: number): boolean => {
    if (!(ts.isForInStatement(node) || ts.isForOfStatement(node))) {
      return false;
    }
    addStructural(nesting);
    scan(node.initializer, nesting);
    scan(node.expression, nesting);
    scan(node.statement, nesting + 1);
    return true;
  };

  const handleWhileStatement = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isWhileStatement(node)) {
      return false;
    }
    addStructural(nesting);
    scan(node.expression, nesting);
    scan(node.statement, nesting + 1);
    return true;
  };

  const handleDoStatement = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isDoStatement(node)) {
      return false;
    }
    addStructural(nesting);
    scan(node.statement, nesting + 1);
    scan(node.expression, nesting);
    return true;
  };

  const handleCaseBlock = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isCaseBlock(node)) {
      return false;
    }
    node.clauses.forEach((clause) => {
      scanNodes(clause.statements, nesting);
    });
    return true;
  };

  const handleSwitchStatement = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isSwitchStatement(node)) {
      return false;
    }
    addStructural(nesting);
    scan(node.expression, nesting);
    scan(node.caseBlock, nesting + 1);
    return true;
  };

  const handleCatchClause = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isCatchClause(node)) {
      return false;
    }
    addStructural(nesting);
    scan(node.block, nesting + 1);
    return true;
  };

  const handleConditionalExpression = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isConditionalExpression(node)) {
      return false;
    }
    addStructural(nesting);
    scan(node.condition, nesting);
    scan(node.whenTrue, nesting + 1);
    scan(node.whenFalse, nesting + 1);
    return true;
  };

  const handleJumpStatement = (node: ts.Node): boolean => {
    if (!(ts.isBreakStatement(node) || ts.isContinueStatement(node))) {
      return false;
    }
    if (node.label) {
      addFundamental();
    }
    return true;
  };

  const handleCallExpression = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isCallExpression(node)) {
      return false;
    }
    recordCall(node.expression, node.arguments.length);
    scan(node.expression, nesting);
    scanNodes(node.typeArguments, nesting);
    scanNodes(node.arguments, nesting);
    return true;
  };

  const handleLogicalBinaryExpression = (node: ts.Node, nesting: number): boolean => {
    if (!ts.isBinaryExpression(node)) {
      return false;
    }
    const operator = logicalOperator(node.operatorToken.kind);
    if (!operator) {
      return false;
    }
    if (isIgnoredJsxLogicalChain(node)) {
      scan(node.left, nesting);
      scan(node.right, nesting);
      return true;
    }
    if (operator === "&&" || operator === "||") {
      scanLogicalExpression(node, nesting, null);
      return true;
    }
    return false;
  };

  const scanNegatedLogicalExpression = (expression: ts.Expression, nesting: number): boolean => {
    if (!(ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken)) {
      return false;
    }
    scanLogicalExpression(expression.operand, nesting, null);
    return true;
  };

  const scanLogicalBinaryExpression = (
    expression: ts.Expression,
    nesting: number,
    previousOperator: LogicalOperator
  ): boolean => {
    if (!ts.isBinaryExpression(expression)) {
      return false;
    }
    const operator = logicalOperator(expression.operatorToken.kind);
    if (!operator) {
      return false;
    }
    return handleTrackedLogicalOperator(expression, nesting, previousOperator, operator);
  };

  const handleTrackedLogicalOperator = (
    expression: ts.BinaryExpression,
    nesting: number,
    previousOperator: LogicalOperator,
    operator: "&&" | "||" | "??"
  ): boolean => {
    if (operator === "??") {
      scan(expression.left, nesting);
      scan(expression.right, nesting);
      return true;
    }
    if (previousOperator !== operator) {
      addFundamental();
    }
    scanLogicalExpression(expression.left, nesting, operator);
    scanLogicalExpression(expression.right, nesting, operator);
    return true;
  };

  const nodeHandlers = [
    handleIfStatement,
    handleForStatement,
    handleForEachStatement,
    handleWhileStatement,
    handleDoStatement,
    handleCaseBlock,
    handleSwitchStatement,
    handleCatchClause,
    handleConditionalExpression,
    handleJumpStatement,
    handleCallExpression,
    handleLogicalBinaryExpression
  ];

  const scan = (node: ts.Node | undefined, nesting: number): void => {
    if (!node) {
      return;
    }
    if (node !== root && isNestedFunctionLike(node)) {
      return;
    }
    for (const handler of nodeHandlers) {
      if (handler(node, nesting)) {
        return;
      }
    }
    ts.forEachChild(node, (child) => {
      scan(child, nesting);
    });
  };

  scan(root.body, 0);
  return { cognitiveComplexity, calls };
}

function resolveCallSymbol(expression: ts.Expression, checker: ts.TypeChecker): ts.Symbol | null {
  return resolveSymbol(symbolLookupNode(expression), checker);
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

function fallbackCallTarget(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  containerName: string | null
): Pick<CallTarget, "name" | "ownerName"> {
  return (
    resolveIdentifierCallTarget(expression) ??
    resolvePropertyAccessCallTarget(expression, sourceFile, containerName) ??
    resolveElementAccessCallTarget(expression, sourceFile, containerName) ?? { name: null, ownerName: null }
  );
}

function resolveIdentifierCallTarget(expression: ts.Expression): Pick<CallTarget, "name" | "ownerName"> | null {
  return ts.isIdentifier(expression)
    ? {
        name: expression.text,
        ownerName: null
      }
    : null;
}

function resolvePropertyAccessCallTarget(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  containerName: string | null
): Pick<CallTarget, "name" | "ownerName"> | null {
  return ts.isPropertyAccessExpression(expression)
    ? {
        name: expression.name.text,
        ownerName: ownerText(expression.expression, sourceFile, containerName)
      }
    : null;
}

function resolveElementAccessCallTarget(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  containerName: string | null
): Pick<CallTarget, "name" | "ownerName"> | null {
  return ts.isElementAccessExpression(expression) && expression.argumentExpression
    ? {
        name: `[${expression.argumentExpression.getText(sourceFile)}]`,
        ownerName: ownerText(expression.expression, sourceFile, containerName)
      }
    : null;
}

function ownerText(expression: ts.Expression, sourceFile: ts.SourceFile, containerName: string | null): string | null {
  if (expression.kind === ts.SyntaxKind.ThisKeyword || expression.kind === ts.SyntaxKind.SuperKeyword) {
    return containerName;
  }
  return expression.getText(sourceFile);
}

function logicalOperator(kind: ts.SyntaxKind): "&&" | "||" | "??" | null {
  if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return "&&";
  }
  if (kind === ts.SyntaxKind.BarBarToken) {
    return "||";
  }
  if (kind === ts.SyntaxKind.QuestionQuestionToken) {
    return "??";
  }
  return null;
}

function isIgnoredJsxLogicalChain(node: ts.BinaryExpression): boolean {
  if (!isLogicalBinary(node)) {
    return false;
  }
  const topmost = topmostLogicalExpression(node);
  return hasJsxExpressionAncestor(topmost) && isJsxLikeNode(rightmostLogicalOperand(topmost));
}

function isLogicalBinary(node: ts.Node): node is ts.BinaryExpression {
  return (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  );
}

function hasJsxExpressionAncestor(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxExpression(current)) {
      return true;
    }
    if (ts.isFunctionLike(current) || ts.isSourceFile(current)) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

function rightmostLogicalOperand(node: ts.BinaryExpression): ts.Node {
  let current: ts.Node = node;
  while (ts.isBinaryExpression(current) && isLogicalBinary(current)) {
    current = unwrapParentheses(current.right);
  }
  return current;
}

function isJsxLikeNode(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node);
}

function symbolLookupNode(expression: ts.Expression): ts.Node {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name;
  }
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    return expression.argumentExpression;
  }
  return expression;
}

function topmostLogicalExpression(node: ts.BinaryExpression): ts.BinaryExpression {
  let current = node;
  while (ts.isBinaryExpression(current.parent) && isLogicalBinary(current.parent)) {
    current = current.parent;
  }
  return current;
}

function unwrapParentheses<T extends ts.Node>(node: T): T {
  let current: ts.Node = node;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current as T;
}

export function isNestedFunctionLike(node: ts.Node): node is NamedFunctionLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  );
}
