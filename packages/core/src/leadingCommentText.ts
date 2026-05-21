export function leadingFileCommentText(sourceText: string): string {
  return sourceText.match(/^\uFEFF?(?:#![^\n]*\n)?(?:\s|\/\/.*?(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*/u)?.[0] ?? "";
}
