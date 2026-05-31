import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseFileMethods } from "../src/index";
import { createTempDir, disposeTempDir, writeProjectFiles } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("Cognitive Complexity operator semantics", () => {
  it("counts logical && and || by operator transition", async () => {
    const methods = await parseSource(`
export function andRun(a: boolean, b: boolean, c: boolean, d: boolean): boolean {
  return a && b && c && d;
}

export function orRun(a: boolean, b: boolean, c: boolean, d: boolean): boolean {
  return a || b || c || d;
}

export function andThenOr(a: boolean, b: boolean, c: boolean, d: boolean): boolean {
  return a && b || c || d;
}

export function andOrAnd(a: boolean, b: boolean, c: boolean, d: boolean): boolean {
  return a && b || c && d;
}
`);

    expect(toComplexityMap(methods)).toEqual({
      andRun: 1,
      orRun: 1,
      andThenOr: 2,
      andOrAnd: 3
    });
  });

  it("keeps nullish coalescing and optional chaining free", async () => {
    const methods = await parseSource(`
export function defaultNullish(value?: string): string {
  const label = value ?? "";
  return label;
}

export function nonDefaultNullish(left?: string, right?: string): string | undefined {
  return left ?? right;
}

export function optionalAccess(input?: { user?: { name?: string } }): string | undefined {
  return input?.user?.name;
}

export function optionalNullishTernary(input: { user?: { name?: string }; demo: boolean }): string {
  return input.user?.name ?? (input.demo ? "demo" : "none");
}
`);

    expect(toComplexityMap(methods)).toEqual({
      defaultNullish: 0,
      nonDefaultNullish: 0,
      optionalAccess: 0,
      optionalNullishTernary: 1
    });
  });

  it("keeps logical assignment operators free", async () => {
    const methods = await parseSource(`
export function logicalAssignments(left: boolean | undefined, right: boolean): boolean | undefined {
  left &&= right;
  left ||= right;
  left ??= right;
  return left;
}
`);

    expect(toComplexityMap(methods)).toEqual({
      logicalAssignments: 0
    });
  });

  it("resets logical operator sequences inside negated groups", async () => {
    const methods = await parseSource(`
export function negatedGroup(a: boolean, b: boolean, c: boolean): number {
  if (a && !(b && c)) {
    return 1;
  }
  return 0;
}
`);

    expect(toComplexityMap(methods)).toEqual({
      negatedGroup: 3
    });
  });

  it("excludes JSX short-circuit rendering shorthand", async () => {
    const methods = await parseSource(
      `
interface Props {
  ok: boolean;
  label: string;
}

export const Widget = ({ ok, label }: Props) => (
  <>{ok && <strong>{label}</strong>}</>
);

export const Banner = ({ ok, label }: Props) => (
  <>{ok && (label ? <strong>{label}</strong> : <em>none</em>)}</>
);
`,
      "sample.tsx"
    );

    expect(toComplexityMap(methods)).toEqual({
      Widget: 0,
      Banner: 2
    });
  });

  it("scores nested functions independently from enclosing operators", async () => {
    const methods = await parseSource(`
export function outer(a: boolean, b: boolean): boolean {
  const inner = () => a && b;
  return inner();
}
`);

    expect(toComplexityMap(methods)).toEqual({
      inner: 1,
      outer: 0
    });
  });

  it("keeps ternary and switch/default scoring separate from operator semantics", async () => {
    const methods = await parseSource(`
export function nestedTernary(a: boolean, b: boolean, c: boolean): number {
  return a ? (b ? 1 : 2) : c ? 3 : 4;
}

export function switchDefault(value: string): number {
  switch (value) {
    default:
      return 0;
  }
}
`);

    expect(toComplexityMap(methods)).toEqual({
      nestedTernary: 5,
      switchDefault: 1
    });
  });
});

async function parseSource(
  source: string,
  fileName = "sample.ts"
): Promise<Awaited<ReturnType<typeof parseFileMethods>>> {
  const projectRoot = await createTempDir("cognitive-operators-");
  tempDirs.push(projectRoot);
  const filePath = path.join(projectRoot, fileName);
  await writeProjectFiles(projectRoot, { [fileName]: source });
  return parseFileMethods(filePath);
}

function toComplexityMap(methods: Awaited<ReturnType<typeof parseFileMethods>>): Record<string, number> {
  return Object.fromEntries(methods.map((method) => [method.displayName, method.cognitiveComplexity]));
}
