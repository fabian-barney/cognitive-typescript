import ts from "typescript";

export function stablePropertyName(name: ts.PropertyName, sourceFile: ts.SourceFile): string {
  return staticPropertyName(name) ?? anonymousName(name, sourceFile);
}

export function staticPropertyName(name: ts.PropertyName): string | null {
  if (ts.isPrivateIdentifier(name)) {
    return name.escapedText.toString();
  }
  if (ts.isComputedPropertyName(name)) {
    return staticComputedPropertyName(name);
  }
  return name.text;
}

export function staticElementAccessName(argumentExpression: ts.Expression | undefined): string | null {
  if (!argumentExpression) {
    return null;
  }
  const expression = unwrapParentheses(argumentExpression);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return `[${JSON.stringify(expression.text)}]`;
  }
  if (ts.isNumericLiteral(expression)) {
    return `[${expression.text}]`;
  }
  return null;
}

export function staticExpressionName(expression: ts.Expression, thisOrSuperName: string | null = null): string | null {
  const unwrapped = unwrapParentheses(expression);
  return (
    staticTerminalExpressionName(unwrapped, thisOrSuperName) ??
    staticPropertyAccessExpressionName(unwrapped, thisOrSuperName) ??
    staticElementAccessExpressionName(unwrapped, thisOrSuperName)
  );
}

export function anonymousName(node: ts.Node, sourceFile: ts.SourceFile): string {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `anonymous@${position.line + 1}:${position.character + 1}`;
}

function staticComputedPropertyName(name: ts.ComputedPropertyName): string | null {
  const expression = unwrapParentheses(name.expression);
  if (ts.isIdentifier(expression)) {
    return `[${expression.text}]`;
  }
  return staticElementAccessName(expression);
}

function staticTerminalExpressionName(expression: ts.Expression, thisOrSuperName: string | null): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  return isThisOrSuperKeyword(expression) ? thisOrSuperName : null;
}

function staticPropertyAccessExpressionName(
  expression: ts.Expression,
  thisOrSuperName: string | null
): string | null {
  return ts.isPropertyAccessExpression(expression)
    ? joinName(staticExpressionName(expression.expression, thisOrSuperName), expression.name.text)
    : null;
}

function staticElementAccessExpressionName(
  expression: ts.Expression,
  thisOrSuperName: string | null
): string | null {
  return ts.isElementAccessExpression(expression)
    ? joinName(
        staticExpressionName(expression.expression, thisOrSuperName),
        staticElementAccessName(expression.argumentExpression)
      )
    : null;
}

function joinName(ownerName: string | null, memberName: string | null): string | null {
  if (!(ownerName && memberName)) {
    return null;
  }
  return memberName.startsWith("[") ? `${ownerName}${memberName}` : `${ownerName}.${memberName}`;
}

function isThisOrSuperKeyword(expression: ts.Expression): boolean {
  return expression.kind === ts.SyntaxKind.ThisKeyword || expression.kind === ts.SyntaxKind.SuperKeyword;
}

function unwrapParentheses<T extends ts.Node>(node: T): T {
  let current: ts.Node = node;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current as T;
}
