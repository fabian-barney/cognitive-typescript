import js from "@eslint/js";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const NODE_GLOBALS = globals.node;
const TEST_GLOBALS = {
  afterAll: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  it: "readonly",
  test: "readonly",
  vi: "readonly"
};

const TYPESCRIPT_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];
const TEST_FILES = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.mts",
  "**/*.test.cts",
  "**/*.test.js",
  "**/*.test.mjs",
  "**/*.test.cjs"
];

export default tseslint.config(
  {
    ignores: [
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/*.d.mts",
      "**/*.d.cts",
      "**/*.tsbuildinfo",
      "tests/fixtures/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: TYPESCRIPT_FILES,
    languageOptions: {
      ...config.languageOptions,
      globals: {
        ...NODE_GLOBALS
      }
    }
  })),
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: {
        ...NODE_GLOBALS
      }
    }
  },
  {
    files: TEST_FILES,
    languageOptions: {
      globals: {
        ...NODE_GLOBALS,
        ...TEST_GLOBALS
      }
    }
  },
  eslintConfigPrettier
);
