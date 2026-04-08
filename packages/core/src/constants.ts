export const COGNITIVE_COMPLEXITY_THRESHOLD = 25;
export const NO_FILES_MESSAGE = "No TypeScript files to analyze.";
export const NO_ANALYZABLE_FUNCTIONS_MESSAGE = "No function-like bodies to analyze.";

export const IGNORED_DIRECTORIES = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules"
]);
