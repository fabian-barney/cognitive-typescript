import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseFileMethods } from "../src/index";
import { analyzeTypeScriptFiles } from "../src/parser";
import { createTempDir, disposeTempDir, repoPath, writeProjectFiles } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("parseFileMethods", () => {
  it("captures constructors, accessors, computed names, and default exports", async () => {
    const projectRoot = await createTempDir("cognitive-parser-");
    tempDirs.push(projectRoot);
    const filePath = path.join(projectRoot, "sample.ts");
    await writeProjectFiles(projectRoot, {
      "sample.ts": `const renderKey = "render";

export class Example {
  constructor(flag: boolean) {
    if (flag) {
      return;
    }
  }

  get value(): number {
    if (this.count > 0) {
      return 1;
    }
    return 0;
  }

  set value(flag: boolean) {
    if (flag) {
      this.count = 1;
    }
  }

  [renderKey](flag: boolean): number {
    if (flag) {
      return 1;
    }
    return 0;
  }

  private count = 0;
}

export default function () {
  return 1;
}
`
    });

    const methods = await parseFileMethods(filePath);
    expect(toComplexityMap(methods)).toEqual({
      "Example.constructor": 1,
      "Example.get value": 1,
      "Example.set value": 1,
      "Example[renderKey]": 1,
      default: 0
    });
  });

  it("ignores declarative outer wrappers and still reports nested assigned functions", async () => {
    const projectRoot = await createTempDir("cognitive-parser-");
    tempDirs.push(projectRoot);
    const filePath = path.join(projectRoot, "sample.ts");
    await writeProjectFiles(projectRoot, {
      "sample.ts": `export const namespaceWrapper = function () {
  const foo = 1;
  registry.handler = function () {
    if (foo) {
      return 1;
    }
    return 0;
  };
};
`
    });

    const methods = await parseFileMethods(filePath);
    expect(toComplexityMap(methods)).toEqual({
      "registry.handler": 1
    });
  });

  it("parses repository fixtures with stable names", async () => {
    const filePath = repoPath(
      "tests",
      "fixtures",
      "compatibility-matrix",
      "property-assigned-functions",
      "src",
      "sample.ts"
    );

    const methods = await parseFileMethods(filePath);
    expect(toComplexityMap(methods)).toEqual({
      "Example.handler": 1,
      "registry.trim": 0,
      'registry["upper"]': 1
    });
  });

  it("marks identifier and element-access self calls as recursive", async () => {
    const projectRoot = await createTempDir("cognitive-parser-");
    tempDirs.push(projectRoot);
    const filePath = path.join(projectRoot, "sample.ts");
    await writeProjectFiles(projectRoot, {
      "sample.ts": `export function recurse(flag: boolean): number {
  if (flag) {
    return recurse(false);
  }
  return 0;
}

export const registry = {
  ["recurse"](flag: boolean): number {
    if (flag) {
      return registry["recurse"](false);
    }
    return 0;
  }
};
`
    });

    const methods = await parseFileMethods(filePath);
    expect(toComplexityMap(methods)).toEqual({
      recurse: 2,
      'registry["recurse"]': 2
    });
  });

  it("captures leading file comments after BOM, shebang, and whitespace trivia", async () => {
    const projectRoot = await createTempDir("cognitive-parser-");
    tempDirs.push(projectRoot);
    const filePath = path.join(projectRoot, "sample.ts");
    await writeProjectFiles(projectRoot, {
      "sample.ts":
        "\uFEFF#!/usr/bin/env node\n\n// @generated\n/* generated header */\nexport function sample() {\n  return 1;\n}\n"
    });

    const [parsed] = await analyzeTypeScriptFiles([filePath]);

    expect(parsed?.fileLeadingCommentText).toContain("// @generated");
    expect(parsed?.fileLeadingCommentText).toContain("/* generated header */");
  });
});

function toComplexityMap(methods: Awaited<ReturnType<typeof parseFileMethods>>): Record<string, number> {
  return Object.fromEntries(methods.map((method) => [method.displayName, method.cognitiveComplexity]));
}
