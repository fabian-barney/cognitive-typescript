import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseFileMethods } from "../src/index";
import { createTempDir, disposeTempDir, writeProjectFiles } from "./testUtils";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(disposeTempDir));
});

describe("Cognitive Complexity PDF examples", () => {
  it("matches the switch and labeled-loop examples", async () => {
    const methods = await parseSource(`
export function sumOfPrimes(max: number): number {
  let total = 0;
  OUT: for (let i = 1; i <= max; ++i) {
    for (let j = 2; j < i; ++j) {
      if (i % j === 0) {
        continue OUT;
      }
    }
    total += i;
  }
  return total;
}

export function getWords(number: number): string {
  switch (number) {
    case 1:
      return "one";
    case 2:
      return "a couple";
    case 3:
      return "a few";
    default:
      return "lots";
  }
}
`);

    expect(toComplexityMap(methods)).toEqual({
      sumOfPrimes: 7,
      getWords: 1
    });
  });

  it("matches the logical-operator examples", async () => {
    const methods = await parseSource(`
export function logical(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean, f: boolean): number {
  if (a && b && c || d || e && f) {
    return 1;
  }
  return 0;
}

export function negated(a: boolean, b: boolean, c: boolean): number {
  if (a && !(b && c)) {
    return 1;
  }
  return 0;
}
`);

    expect(toComplexityMap(methods)).toEqual({
      logical: 4,
      negated: 3
    });
  });

  it("matches the nesting and catch example", async () => {
    const methods = await parseSource(`
export function myMethod(condition1: boolean, condition2: boolean): void {
  try {
    if (condition1) {
      for (let i = 0; i < 10; i += 1) {
        while (condition2) {
          return;
        }
      }
    }
  } catch (error) {
    if (condition2) {
      return;
    }
  }
}
`);

    expect(toComplexityMap(methods)).toEqual({
      myMethod: 9
    });
  });

  it("adapts the lambda example to independent nested-function scoring", async () => {
    const methods = await parseSource(`
export function myMethod2(condition1: boolean): void {
  const runnable = () => {
    if (condition1) {
      return;
    }
  };
  void runnable;
}
`);

    expect(toComplexityMap(methods)).toEqual({
      myMethod2: 0,
      runnable: 1
    });
  });

  it("matches the larger appendix examples", async () => {
    const methods = await parseSource(`
declare const Symbols: any;
declare const name: string;
declare function canOverride(value: any): boolean;
declare function checkOverridingParameters(methodJavaSymbol: any, classType: any): boolean | null;
declare const TIMED_OUT: number;
declare const ABORTED: number;
declare const frst: any;
declare const _persistit: any;
declare const SharedResource: any;
declare class RollbackException extends Error {}
declare class WWRetryException extends Error {}
declare class PersistitInterruptedException extends Error {}
declare function isSlash(value: string): boolean;

export function overriddenSymbolFrom(classType: any): any {
  if (classType.isUnknown()) {
    return Symbols.unknownMethodSymbol;
  }

  let unknownFound = false;
  const symbols = classType.getSymbol().members().lookup(name);
  for (const overrideSymbol of symbols) {
    if (overrideSymbol.isKind("MTH") && !overrideSymbol.isStatic()) {
      const methodJavaSymbol = overrideSymbol;
      if (canOverride(methodJavaSymbol)) {
        const overriding = checkOverridingParameters(methodJavaSymbol, classType);
        if (overriding == null) {
          if (!unknownFound) {
            unknownFound = true;
          }
        } else if (overriding) {
          return methodJavaSymbol;
        }
      }
    }
  }

  if (unknownFound) {
    return Symbols.unknownMethodSymbol;
  }

  return null;
}

export function addVersion(entry: any, txn: any): void {
  const ti = _persistit.getTransactionIndex();
  while (true) {
    try {
      if (frst != null) {
        if (frst.getVersion() > entry.getVersion()) {
          throw new RollbackException();
        }
        if (txn.isActive()) {
          for (let current = frst; current != null; current = current.getPrevious()) {
            const version = current.getVersion();
            const depends = ti.wwDependency(version, txn.getTransactionStatus(), 0);
            if (depends === TIMED_OUT) {
              throw new WWRetryException(version);
            }
            if (depends !== 0 && depends !== ABORTED) {
              throw new RollbackException();
            }
          }
        }
      }
      entry.setPrevious(frst);
      break;
    } catch (error) {
      if (error instanceof WWRetryException) {
        try {
          const depends = _persistit
            .getTransactionIndex()
            .wwDependency(error.getVersionHandle(), txn.getTransactionStatus(), SharedResource.DEFAULT_MAX_WAIT_TIME);
          if (depends !== 0 && depends !== ABORTED) {
            throw new RollbackException();
          }
        } catch (ie) {
          throw new PersistitInterruptedException(String(ie));
        }
      } else {
        throw new PersistitInterruptedException(String(error));
      }
    }
  }
}

export function toRegexp(antPattern: string, directorySeparator: string): string {
  const escapedDirectorySeparator = "\\\\" + directorySeparator;
  let result = "^";
  let i = antPattern.startsWith("/") || antPattern.startsWith("\\\\") ? 1 : 0;
  while (i < antPattern.length) {
    const ch = antPattern.charAt(i);
    if ("[]".indexOf(ch) !== -1) {
      result += "\\\\" + ch;
    } else if (ch === "*") {
      if (i + 1 < antPattern.length && antPattern.charAt(i + 1) === "*") {
        if (i + 2 < antPattern.length && isSlash(antPattern.charAt(i + 2))) {
          result += "(?:.*" + escapedDirectorySeparator + "|)";
          i += 2;
        } else {
          result += ".*";
          i += 1;
        }
      } else {
        result += "[^" + escapedDirectorySeparator + "]*?";
      }
    } else if (ch === "?") {
      result += "[^" + escapedDirectorySeparator + "]";
    } else if (isSlash(ch)) {
      result += escapedDirectorySeparator;
    } else {
      result += ch;
    }
    i += 1;
  }
  result += "$";
  return result;
}
`);

    expect(toComplexityMap(methods)).toEqual({
      overriddenSymbolFrom: 19,
      addVersion: 39,
      toRegexp: 20
    });
  });
});

async function parseSource(source: string): Promise<Awaited<ReturnType<typeof parseFileMethods>>> {
  const projectRoot = await createTempDir("cognitive-pdf-");
  tempDirs.push(projectRoot);
  const filePath = path.join(projectRoot, "sample.ts");
  await writeProjectFiles(projectRoot, { "sample.ts": source });
  return parseFileMethods(filePath);
}

function toComplexityMap(methods: Awaited<ReturnType<typeof parseFileMethods>>): Record<string, number> {
  return Object.fromEntries(methods.map((method) => [method.displayName, method.cognitiveComplexity]));
}
