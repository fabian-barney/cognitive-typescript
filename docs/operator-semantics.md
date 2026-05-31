# Cognitive Complexity Operator Semantics

`cognitive-typescript` preserves its existing TypeScript operator semantics:

- `&&` and `||` count by logical-operator transition.
- `??`, optional chaining, and logical assignment operators are shorthand and do not add Cognitive Complexity.
- JSX short-circuit rendering is ignored when the logical expression acts as rendering shorthand.
- Ternaries, `switch`, and labeled jumps keep their normal Cognitive Complexity rules.

## Scored Operators

Logical `&&` and `||` expressions are flattened into a sequence. The first operator in a run adds `+1`; a transition between `&&` and `||` adds another `+1`; repeated operators in the same run do not add more.

Examples:

| Expression | Cognitive Complexity Increment |
| --- | --- |
| `a && b && c && d` | `+1` |
| `a || b || c || d` | `+1` |
| `a && b || c || d` | `+2` |
| `a && b || c && d` | `+3` |

Negated logical groups start their own sequence, so `if (a && !(b && c))` scores `+3`: one for the `if`, one for the outer `&&`, and one for the nested negated `&&`.

## Free Shorthand

These forms do not add Cognitive Complexity directly:

| Construct | Example | Increment |
| --- | --- | --- |
| Optional chaining | `input?.user?.name` | `+0` |
| Nullish coalescing | `left ?? right` | `+0` |
| Default nullish value | `const label = value ?? ""` | `+0` |
| Logical assignment | `a ??= b`, `a &&= b`, `a ||= b` | `+0` |
| JSX rendering shorthand | `{ok && <Widget />}` | `+0` |

If a free shorthand expression contains another scored construct, only the scored construct contributes. For example, `input.user?.name ?? (input.demo ? "demo" : "none")` scores `+1` for the ternary only.

## Comparison

| Tool or Rule Family | `&&` | `||` | `??` | `?.` | `??=` / `&&=` / `||=` |
| --- | --- | --- | --- | --- | --- |
| `cognitive-typescript` | transition | transition | free | free | free |
| Current SonarJS | transition | free | free | free | free |
| SonarJava / white paper | transition | transition | n/a | n/a | n/a |
| Archived `eslint-plugin-sonarjs` | transition | transition | transition except narrow defaults | free | free |
| Biome | transition | transition | transition | free | free |

CRAP and cyclomatic tools may count some of these JavaScript constructs as branch points. That behavior is intentionally separate from Cognitive Complexity here; `switch` default-clause coverage behavior and logical-assignment branch attribution are not part of this analyzer's scoring model.
