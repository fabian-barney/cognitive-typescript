export const COGNITIVE_COMPLEXITY_THRESHOLD = 15;
export const NO_FILES_MESSAGE = "No TypeScript files to analyze.";
export const NO_ANALYZABLE_FUNCTIONS_MESSAGE = "No function-like bodies to analyze.";

export function validateThreshold(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Threshold must be a positive integer");
  }
  return value;
}

export const IGNORED_DIRECTORIES = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules"
]);
