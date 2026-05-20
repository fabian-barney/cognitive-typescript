import path from "node:path";

import ts from "typescript";

import { collectMethodsFromSourceFile } from "./functionDiscovery";
import type { InternalMethod, ParsedFileMethods, ParsedMethodDescriptor } from "./analysisModel";
import { leadingFileCommentText } from "./leadingCommentText";
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

  const selectedFiles = new Set(resolvedFiles.map(normalizeFilePath));
  const program = createTypeScriptProgram(resolvedFiles);
  const selectedSourceFiles = selectProgramSourceFiles(program, selectedFiles);
  ensureSelectedFilesParse(program, selectedSourceFiles);
  const methods = collectSelectedMethods(program, selectedSourceFiles);
  const recursiveIds = recursiveMethodIds(methods);
  return buildParsedFileMethods(resolvedFiles, selectedSourceFiles, methods, recursiveIds);
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
  return resolveDirectCallTargets(call, methodsBySymbol)
    ?? resolveOwnerCallTargets(call, methodsByOwnerAndName)
    ?? resolveNamedCallTargets(call, method, methodsByName)
    ?? new Set();
}

function resolveDirectCallTargets(
  call: InternalMethod["calls"][number],
  methodsBySymbol: Map<ts.Symbol, Set<string>>
): Set<string> | null {
  return call.symbol ? methodsBySymbol.get(call.symbol) ?? null : null;
}

function resolveOwnerCallTargets(
  call: InternalMethod["calls"][number],
  methodsByOwnerAndName: Map<string, Set<string>>
): Set<string> | null {
  if (!(call.name && call.ownerName)) {
    return null;
  }
  const ownerMatches = methodsByOwnerAndName.get(ownerAndNameKey(call.ownerName, call.name, call.arity));
  return ownerMatches?.size ? ownerMatches : null;
}

function resolveNamedCallTargets(
  call: InternalMethod["calls"][number],
  method: InternalMethod,
  methodsByName: Map<string, Set<string>>
): Set<string> | null {
  if (!call.name) {
    return null;
  }
  return selectNamedCallTargets(methodsByName.get(nameKey(call.name, call.arity)), method.id);
}

function selectNamedCallTargets(globalMatches: Set<string> | undefined, methodId: string): Set<string> | null {
  if (globalMatches?.has(methodId)) {
    return new Set([methodId]);
  }
  return selectSingleNamedCallTarget(globalMatches);
}

function selectSingleNamedCallTarget(globalMatches: Set<string> | undefined): Set<string> | null {
  return globalMatches?.size === 1 ? globalMatches : null;
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

    visitRecursiveTargets(node, edges, methodsById, strongConnect, indexByNode, lowLinkByNode, onStack);
    if (!isComponentRoot(node, indexByNode, lowLinkByNode)) {
      return;
    }
    markRecursiveComponent(popComponent(node, stack, onStack), edges, recursiveMembers);
  };

  for (const node of edges.keys()) {
    if (!indexByNode.has(node)) {
      strongConnect(node);
    }
  }

  return recursiveMembers;
}

function sortDescriptors<T extends MethodDescriptor>(methods: T[]): T[] {
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

function createTypeScriptProgram(rootNames: string[]): ts.Program {
  return ts.createProgram({
    rootNames,
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
}

function selectProgramSourceFiles(program: ts.Program, selectedFiles: Set<string>): ts.SourceFile[] {
  return program.getSourceFiles().filter((sourceFile) => selectedFiles.has(normalizeFilePath(sourceFile.fileName)));
}

function ensureSelectedFilesParse(program: ts.Program, sourceFiles: ts.SourceFile[]): void {
  for (const sourceFile of sourceFiles) {
    const diagnostics = program.getSyntacticDiagnostics(sourceFile);
    if (diagnostics.length > 0) {
      throw new Error(formatDiagnostics(diagnostics));
    }
  }
}

function collectSelectedMethods(program: ts.Program, sourceFiles: ts.SourceFile[]): InternalMethod[] {
  const checker = program.getTypeChecker();
  const methods: InternalMethod[] = [];
  for (const sourceFile of sourceFiles) {
    methods.push(...collectMethodsFromSourceFile(sourceFile, checker));
  }
  return methods;
}

function buildParsedFileMethods(
  resolvedFiles: string[],
  sourceFiles: ts.SourceFile[],
  methods: InternalMethod[],
  recursiveIds: Set<string>
): ParsedFileMethods[] {
  const methodsByFile = new Map<string, ParsedMethodDescriptor[]>();
  for (const method of methods) {
    const descriptors = methodsByFile.get(method.filePath) ?? [];
    descriptors.push(toMethodDescriptor(method, recursiveIds));
    methodsByFile.set(method.filePath, descriptors);
  }
  const sourceFilesByPath = new Map(
    sourceFiles.map((sourceFile) => [normalizeFilePath(sourceFile.fileName), sourceFile] as const)
  );
  return resolvedFiles.map((filePath) => ({
    filePath,
    fileLeadingCommentText: leadingFileCommentText(sourceFilesByPath.get(filePath)?.text ?? ""),
    methods: sortDescriptors(methodsByFile.get(filePath) ?? [])
  }));
}

function toMethodDescriptor(method: InternalMethod, recursiveIds: Set<string>): ParsedMethodDescriptor {
  return {
    functionName: method.functionName,
    containerName: method.containerName,
    displayName: method.displayName,
    startLine: method.startLine,
    endLine: method.endLine,
    bodySpan: method.bodySpan,
    cognitiveComplexity: method.baseCognitiveComplexity + (recursiveIds.has(method.id) ? 1 : 0),
    exclusionNames: method.exclusionNames,
    decoratorNames: method.decoratorNames,
    leadingCommentText: method.leadingCommentText
  };
}

function visitRecursiveTargets(
  node: string,
  edges: Map<string, Set<string>>,
  methodsById: Map<string, InternalMethod>,
  strongConnect: (node: string) => void,
  indexByNode: Map<string, number>,
  lowLinkByNode: Map<string, number>,
  onStack: Set<string>
): void {
  const targets = edges.get(node);
  if (!targets) {
    return;
  }
  for (const target of targets) {
    if (methodsById.has(target)) {
      visitResolvedTarget(node, target, strongConnect, indexByNode, lowLinkByNode, onStack);
    }
  }
}

function visitResolvedTarget(
  node: string,
  target: string,
  strongConnect: (node: string) => void,
  indexByNode: Map<string, number>,
  lowLinkByNode: Map<string, number>,
  onStack: Set<string>
): void {
  if (visitUnseenTarget(node, target, strongConnect, indexByNode, lowLinkByNode)) {
    return;
  }
  updateLowLinkFromStackTarget(node, target, indexByNode, lowLinkByNode, onStack);
}

function visitUnseenTarget(
  node: string,
  target: string,
  strongConnect: (node: string) => void,
  indexByNode: Map<string, number>,
  lowLinkByNode: Map<string, number>
): boolean {
  if (indexByNode.has(target)) {
    return false;
  }
  strongConnect(target);
  lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node)!, lowLinkByNode.get(target)!));
  return true;
}

function updateLowLinkFromStackTarget(
  node: string,
  target: string,
  indexByNode: Map<string, number>,
  lowLinkByNode: Map<string, number>,
  onStack: Set<string>
): void {
  if (!onStack.has(target)) {
    return;
  }
  lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node)!, indexByNode.get(target)!));
}

function isComponentRoot(
  node: string,
  indexByNode: Map<string, number>,
  lowLinkByNode: Map<string, number>
): boolean {
  return lowLinkByNode.get(node) === indexByNode.get(node);
}

function popComponent(node: string, stack: string[], onStack: Set<string>): string[] {
  const component: string[] = [];
  let member = "";
  do {
    member = stack.pop()!;
    onStack.delete(member);
    component.push(member);
  } while (member !== node);
  return component;
}

function markRecursiveComponent(
  component: string[],
  edges: Map<string, Set<string>>,
  recursiveMembers: Set<string>
): void {
  if (component.length > 1) {
    component.forEach((member) => {
      recursiveMembers.add(member);
    });
    return;
  }
  if (edges.get(component[0])?.has(component[0])) {
    recursiveMembers.add(component[0]);
  }
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
