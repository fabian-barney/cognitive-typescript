import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  anonymousName,
  stablePropertyName,
  staticElementAccessName,
  staticExpressionName,
  staticPropertyName
} from "../src/staticNames";

describe("static name helpers", () => {
  it("extracts static property names without source-text fallbacks", () => {
    const sourceFile = source(`const key = "format";

class Example {
  #secret() {}
  value() {}
  "quoted"() {}
  1() {}
  [key]() {}
  ["literal"]() {}
  [factory()]() {}
}
`);
    const names = classMemberNames(sourceFile);

    expect(staticPropertyName(names[0])).toBe("#secret");
    expect(staticPropertyName(names[1])).toBe("value");
    expect(staticPropertyName(names[2])).toBe("quoted");
    expect(staticPropertyName(names[3])).toBe("1");
    expect(staticPropertyName(names[4])).toBe("[key]");
    expect(staticPropertyName(names[5])).toBe('["literal"]');
    expect(staticPropertyName(names[6])).toBeNull();
    expect(stablePropertyName(names[6], sourceFile)).toMatch(/^anonymous@\d+:\d+$/);
  });

  it("extracts only static element-access names", () => {
    expect(staticElementAccessName(undefined)).toBeNull();
    expect(staticElementAccessName(elementArgument('target["literal"]'))).toBe('["literal"]');
    expect(staticElementAccessName(elementArgument("target[`template`]"))).toBe('["template"]');
    expect(staticElementAccessName(elementArgument("target[1]"))).toBe("[1]");
    expect(staticElementAccessName(elementArgument('target[("wrapped")]'))).toBe('["wrapped"]');
    expect(staticElementAccessName(elementArgument("target[key]"))).toBeNull();
  });

  it("builds static expression names and rejects dynamic owners", () => {
    expect(staticExpressionName(expression("target"))).toBe("target");
    expect(staticExpressionName(expression("this"), "Container")).toBe("Container");
    expect(staticExpressionName(expression("target.value"))).toBe("target.value");
    expect(staticExpressionName(expression('target["value"]'))).toBe('target["value"]');
    expect(staticExpressionName(expression("target[key]"))).toBeNull();
    expect(staticExpressionName(expression("factory().value"))).toBeNull();
  });

  it("builds stable anonymous names from source positions", () => {
    const sourceFile = source(`class Example {
  [factory()]() {}
}
`);
    const [name] = classMemberNames(sourceFile);

    expect(anonymousName(name, sourceFile)).toBe("anonymous@2:3");
  });
});

function source(text: string): ts.SourceFile {
  return ts.createSourceFile("sample.ts", text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
}

function classMemberNames(sourceFile: ts.SourceFile): ts.PropertyName[] {
  const classDeclaration = sourceFile.statements.find(ts.isClassDeclaration);
  return classDeclaration?.members.flatMap((member) => (member.name ? [member.name] : [])) ?? [];
}

function elementArgument(text: string): ts.Expression | undefined {
  const parsed = expression(text);
  return ts.isElementAccessExpression(parsed) ? parsed.argumentExpression : undefined;
}

function expression(text: string): ts.Expression {
  const sourceFile = source(`const value = ${text};`);
  const statement = sourceFile.statements[0];
  if (!ts.isVariableStatement(statement)) {
    throw new Error("Expected variable statement.");
  }
  const initializer = statement.declarationList.declarations[0]?.initializer;
  if (!initializer) {
    throw new Error("Expected initializer.");
  }
  return initializer;
}
