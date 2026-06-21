# cognitive-typescript Specification

## 1. Purpose

`cognitive-typescript` is a Cognitive Complexity analyzer for TypeScript projects.

It shall:

- locate TypeScript source files to analyze
- parse function-like bodies with the TypeScript compiler API
- compute Cognitive Complexity using the Sonar white-paper rules, with TypeScript-specific derivations
- report the worst functions first
- fail when any analyzed function exceeds the configured threshold, which defaults to `8`

## 2. Scope

This specification defines:

- workspace layout and published package surface
- command-line behavior
- source file selection rules
- function discovery and naming rules
- Cognitive Complexity scoring rules
- recursion handling
- report ordering and exit codes
- Vitest and Jest adapter behavior

This specification does not define:

- coverage processing
- non-TypeScript source analysis
- machine-readable report formats

## 3. Packages

The repository shall publish four npm packages under the `@barney-media` scope:

- `@barney-media/cognitive-typescript-core`
- `@barney-media/cognitive-typescript`
- `@barney-media/cognitive-typescript-vitest`
- `@barney-media/cognitive-typescript-jest`

The core package shall export, at minimum:

- `analyzeProject`
- `runCli`, `parseCliArguments`, `usage`
- `parseFileMethods`
- `formatReport`, `sortMetrics`
- `COGNITIVE_COMPLEXITY_THRESHOLD`
- `MethodDescriptor`, `MethodMetrics`, `AnalysisResult`, `CliArguments`, and `Writer`

## 4. Command-Line Interface

The CLI shall support these forms:

- `cognitive-typescript`
- `cognitive-typescript --changed`
- `cognitive-typescript <path...>`
- `cognitive-typescript --help`

Invalid argument parsing shall:

- print the usage text to stdout
- print the error message to stderr
- exit with code `1`

`--changed` shall not be accepted together with explicit file or directory paths.

## 5. File Selection Rules

### 5.1 Default Discovery

In default mode, the analyzer shall select analyzable files under any nested `src/` tree below the project root.

### 5.2 Changed-File Discovery

In `--changed` mode, the analyzer shall:

- invoke `git status --porcelain -z`
- interpret modified, added, copied, renamed, updated, and untracked files
- retain only analyzable TypeScript files under a `src/` tree
- sort the resulting file list in path order

### 5.3 Explicit Paths

When explicit paths are supplied:

- analyzable files shall be selected directly
- directories shall expand to analyzable files under any nested `src/` tree inside that directory
- duplicates shall be removed
- the final list shall be sorted in path order

### 5.4 Analyzable Files

The analyzer shall include:

- `.ts`
- `.tsx`
- `.mts`
- `.cts`

The analyzer shall exclude:

- `.d.ts`
- `*.test.*`
- `*.spec.*`
- files under `__tests__/`
- files under `dist/`, `coverage/`, and `node_modules/`

### 5.5 Empty Selection

If no TypeScript files are selected:

- the CLI shall print `No TypeScript files to analyze.`
- the CLI shall exit successfully

## 6. Function Discovery

The parser shall use the TypeScript compiler API and discover independent function-like bodies for:

- function declarations
- anonymous default-exported functions, named as `default`
- function expressions and arrow functions assigned to variables
- function expressions and arrow functions assigned to properties
- class methods
- constructors
- getters and setters
- object literal methods
- class-field arrows
- computed names, rendered consistently such as `Container[name]`

Discovered display names shall preserve deterministic owner context for concrete namespaces, classes, class fields, object literals, and static assignment targets. Owner segments shall be joined with `.`. Static computed names shall use bracket notation, such as `Container[name]` or `registry["key"]`. Dynamic computed assignment names shall not be derived from arbitrary source text; they shall use a stable anonymous positional segment such as `anonymous@<line>:<column>` under any statically known owner.

The parser shall ignore:

- overload signatures without bodies
- abstract, ambient, and declaration-only members
- ambient and namespace-only declaration containers with no concrete bodies
- declaration files

Nested functions shall be scored independently. Their Cognitive Complexity shall not be absorbed into the enclosing function.

## 7. Cognitive Complexity Rules

Each discovered function-like body shall start at `0`.

The analyzer shall apply the Sonar white-paper model, including:

- structural increments for `if`, loops, `switch`, `catch`, and ternary expressions
- hybrid increments for `else if` and `else`
- nesting increments only where the model allows them
- no increment for `try`, `finally`, unlabeled early exits, or function declarations themselves

The analyzer shall score:

- `if`, `else if`, and `else`
- `switch`
- `for`, `for...in`, `for...of`
- `while` and `do...while`
- `catch`
- ternary expressions
- labeled `break` and labeled `continue`
- logical operator sequences for `&&` and `||`

The analyzer shall derive TypeScript and JavaScript behavior as follows:

- `&&` and `||` shall be scored by logical-operator sequence transitions
- repeated `&&` operators in the same flattened logical sequence shall add one total increment
- repeated `||` operators in the same flattened logical sequence shall add one total increment
- mixed `&&` and `||` sequences shall reset sequence counting boundaries and add an increment at each transition
- negated logical groups shall reset sequence counting boundaries
- optional chaining shall be ignored as shorthand
- `??` shall be ignored as shorthand in default-value and non-default contexts
- `??=`, `&&=`, and `||=` shall be ignored as assignment shorthand
- JSX short-circuit rendering forms shall be ignored when they act as rendering shorthand

These JavaScript and TypeScript operator semantics intentionally preserve the
existing score model. They do not exactly mirror a single external tool: `&&`
and `||` follow the Sonar white-paper-style transition model, while `??`,
optional chaining, and logical assignment are treated as shorthand.

## 8. Recursion

The analyzer shall build a project-local call graph across analyzed functions.

It shall:

- add a recursion edge only when a call can be resolved to another analyzed function
- add `+1` to each function in a direct or indirect recursion cycle
- ignore unresolved external calls for recursion purposes

## 9. Report

The formatted report shall contain:

- function name
- Cognitive Complexity
- source location

The report shall be sorted by:

1. Cognitive Complexity descending
2. relative path ascending
3. start line ascending

If files are selected but no function-like bodies are analyzable:

- the CLI shall print `No function-like bodies to analyze.`
- the CLI shall exit successfully

## 10. Threshold

The default threshold shall be `8`. A positive integer threshold may be configured.

If the maximum Cognitive Complexity exceeds the configured threshold:

- the CLI shall print `Cognitive Complexity threshold exceeded: <max> > <threshold>` to stderr
- the CLI shall exit with code `2`

Otherwise the CLI shall exit with code `0`.

## 11. Exit Codes

- `0`: successful analysis, including empty selection and no analyzable functions
- `1`: CLI usage error or execution failure
- `2`: Cognitive Complexity threshold exceeded

## 12. Test Adapters

The Vitest package shall export:

- `withCognitiveTypescriptVitest`
- `CognitiveTypescriptVitestReporter`

The Jest package shall export:

- `withCognitiveTypescriptJest`
- `CognitiveTypescriptJestReporter`

Adapter options shall support:

- `projectRoot`
- `changedOnly`
- `paths`
- `stdout`
- `stderr`

Both adapters shall:

- preserve the default test reporter when wrapping config
- run Cognitive Complexity analysis after the test run
- print the same textual report as the CLI
- fail the process when the threshold is exceeded
