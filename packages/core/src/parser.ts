import path from "node:path";

import ts from "typescript";

import { collectMethodsFromSourceFile } from "./functionDiscovery";
import type { InternalMethod, ParsedFileMethods } from "./analysisModel";
import type { MethodDescriptor } from "./types";
import { normalizeSlashes } from "./utils";

export async function parseFileMethods(filePath: string): Promise<MethodDescriptor[]> {
  const [parsed] = await analyzeTypeScriptFiles([filePath]);
  return parsed?.methods ?? [];
}

export async function analyzeTypeScriptFiles(filePaths: string[]): Promise<ParsedFileMethods[]> {
  const resolvedFiles = uniqueNormalizedFiles(filePaths);
  if (resolvedFiles.length === 0) {
    return [];
  }

  const program = ts.createProgram({
    rootNames: resolvedFiles,
    options: {
      allowJs: false,
      checkJs: false,
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.Node16,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      noEmit: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022
    }
  });
  const checker = program.getTypeChecker();
  const selectedFiles = new Set(resolvedFiles.map(normalizeFilePath));

  for (const sourceFile of program.getSourceFiles()) {
    if (!selectedFiles.has(normalizeFilePath(sourceFile.fileName))) {
      continue;
    }
    const diagnostics = program.getSyntacticDiagnostics(sourceFile);
    if (diagnostics.length > 0) {
      throw new Error(formatDiagnostics(diagnostics));
    }
  }

  const methods: InternalMethod[] = [];
  for (const sourceFile of program.getSourceFiles()) {
    if (!selectedFiles.has(normalizeFilePath(sourceFile.fileName))) {
      continue;
    }
    methods.push(...collectMethodsFromSourceFile(sourceFile, checker));
  }

  const recursiveIds = recursiveMethodIds(methods);
  const methodsByFile = new Map<string, MethodDescriptor[]>();
  for (const method of methods) {
    const descriptors = methodsByFile.get(method.filePath) ?? [];
    descriptors.push({
      functionName: method.functionName,
      containerName: method.containerName,
      displayName: method.displayName,
      startLine: method.startLine,
      endLine: method.endLine,
      bodySpan: method.bodySpan,
      cognitiveComplexity: method.baseCognitiveComplexity + (recursiveIds.has(method.id) ? 1 : 0)
    });
    methodsByFile.set(method.filePath, descriptors);
  }

  return resolvedFiles.map((filePath) => ({
    filePath,
    methods: sortDescriptors(methodsByFile.get(filePath) ?? [])
  }));
}

function recursiveMethodIds(methods: InternalMethod[]): Set<string> {
  const methodsBySymbol = new Map<ts.Symbol, Set<string>>();
  const methodsByName = new Map<string, Set<string>>();
  const methodsByOwnerAndName = new Map<string, Set<string>>();
  const methodsById = new Map<string, InternalMethod>();

  for (const method of methods) {
    methodsById.set(method.id, method);
    method.symbols.forEach((symbol) => {
      addToSetMap(methodsBySymbol, symbol, method.id);
    });
    method.fallbackNames.forEach((fallbackName) => {
      addToSetMap(methodsByName, nameKey(fallbackName, method.parameterCount), method.id);
      if (method.fallbackOwnerName) {
        addToSetMap(
          methodsByOwnerAndName,
          ownerAndNameKey(method.fallbackOwnerName, fallbackName, method.parameterCount),
          method.id
        );
      }
    });
  }

  const edges = new Map<string, Set<string>>();
  for (const method of methods) {
    const targets = new Set<string>();
    for (const call of method.calls) {
      const resolved = resolveCallTargets(call, method, methodsBySymbol, methodsByName, methodsByOwnerAndName);
      resolved.forEach((targetId) => {
        targets.add(targetId);
      });
    }
    edges.set(method.id, targets);
  }

  return stronglyConnectedRecursiveMembers(edges, methodsById);
}

function resolveCallTargets(
  call: InternalMethod["calls"][number],
  method: InternalMethod,
  methodsBySymbol: Map<ts.Symbol, Set<string>>,
  methodsByName: Map<string, Set<string>>,
  methodsByOwnerAndName: Map<string, Set<string>>
): Set<string> {
  if (call.symbol) {
    const direct = methodsBySymbol.get(call.symbol);
    if (direct) {
      return direct;
    }
  }

  if (call.name && call.ownerName) {
    const ownerMatches = methodsByOwnerAndName.get(ownerAndNameKey(call.ownerName, call.name, call.arity));
    if (ownerMatches?.size) {
      return ownerMatches;
    }
  }

  if (!call.name) {
    return new Set();
  }

  const selfMatches = new Set<string>();
  for (const candidate of methodsByName.get(nameKey(call.name, call.arity)) ?? []) {
    if (candidate === method.id) {
      selfMatches.add(candidate);
    }
  }
  if (selfMatches.size > 0) {
    return selfMatches;
  }

  const globalMatches = methodsByName.get(nameKey(call.name, call.arity));
  if (globalMatches?.size === 1) {
    return globalMatches;
  }

  return new Set();
}

function stronglyConnectedRecursiveMembers(
  edges: Map<string, Set<string>>,
  methodsById: Map<string, InternalMethod>
): Set<string> {
  const recursiveMembers = new Set<string>();
  const indexByNode = new Map<string, number>();
  const lowLinkByNode = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  let index = 0;

  const strongConnect = (node: string): void => {
    indexByNode.set(node, index);
    lowLinkByNode.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of edges.get(node) ?? []) {
      if (!methodsById.has(target)) {
        continue;
      }
      if (!indexByNode.has(target)) {
        strongConnect(target);
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node)!, lowLinkByNode.get(target)!));
      } else if (onStack.has(target)) {
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node)!, indexByNode.get(target)!));
      }
    }

    if (lowLinkByNode.get(node) !== indexByNode.get(node)) {
      return;
    }

    const component: string[] = [];
    let member = "";
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== node);

    if (component.length > 1) {
      component.forEach((componentMember) => {
        recursiveMembers.add(componentMember);
      });
      return;
    }

    const singleton = component[0];
    if (edges.get(singleton)?.has(singleton)) {
      recursiveMembers.add(singleton);
    }
  };

  for (const node of edges.keys()) {
    if (!indexByNode.has(node)) {
      strongConnect(node);
    }
  }

  return recursiveMembers;
}

function sortDescriptors(methods: MethodDescriptor[]): MethodDescriptor[] {
  return [...methods].sort((left, right) => {
    if (left.startLine !== right.startLine) {
      return left.startLine - right.startLine;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

function uniqueNormalizedFiles(filePaths: string[]): string[] {
  return Array.from(new Set(filePaths.map((filePath) => normalizeFilePath(path.resolve(filePath))))).sort();
}

function normalizeFilePath(filePath: string): string {
  return normalizeSlashes(path.resolve(filePath));
}

function addToSetMap<TKey>(map: Map<TKey, Set<string>>, key: TKey, value: string): void {
  const existing = map.get(key) ?? new Set<string>();
  existing.add(value);
  map.set(key, existing);
}

function nameKey(name: string, arity: number): string {
  return `${name}:${arity}`;
}

function ownerAndNameKey(ownerName: string, name: string, arity: number): string {
  return `${ownerName}:${name}:${arity}`;
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  const lines = diagnostics.map((diagnostic) => {
    const filePath = diagnostic.file ? normalizeFilePath(diagnostic.file.fileName) : "<unknown>";
    const position = diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      : { line: 0, character: 0 };
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    return `${filePath}:${position.line + 1}:${position.character + 1}: ${message}`;
  });
  return `Failed to parse TypeScript source:\n${lines.join("\n")}`;
}
