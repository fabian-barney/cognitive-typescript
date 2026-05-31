# Compatibility Matrix

This matrix records the TypeScript syntax and Cognitive Complexity behaviors currently verified by fixtures under `tests/fixtures/compatibility-matrix/`.

## Verified

| Shape | Fixture | Notes |
| --- | --- | --- |
| TSX parsing | `tests/fixtures/compatibility-matrix/tsx-component` | Verifies `.tsx` files parse cleanly and expression-bodied components score independently. |
| TSX-adjacent generic arrows | `tests/fixtures/compatibility-matrix/tsx-generic-arrows` | Verifies generic arrow parsing in files that also contain JSX. |
| Accessors | `tests/fixtures/compatibility-matrix/accessors` | Verifies getter and setter discovery and naming. |
| Computed property names | `tests/fixtures/compatibility-matrix/computed-property-names` | Verifies names render as `Container[name]` for classes and object literals. |
| Decorated methods | `tests/fixtures/compatibility-matrix/decorated-methods` | Verifies decorators do not block discovery or scoring. |
| Anonymous default exports | `tests/fixtures/compatibility-matrix/default-export` | Verifies anonymous default-exported functions are named `default`. |
| Expression-bodied arrows and declaration-only bodies | `tests/fixtures/compatibility-matrix/expression-and-declarations` | Verifies expression bodies score correctly and declaration-only bodies stay at `0`. |
| Class and object methods | `tests/fixtures/compatibility-matrix/object-and-class-methods` | Verifies both container forms are discovered and named consistently. |
| Property-assigned functions | `tests/fixtures/compatibility-matrix/property-assigned-functions` | Verifies class-field arrows, property access assignments, and element access assignments. |
| Function discovery hardening | `tests/fixtures/compatibility-matrix/function-discovery-hardening` | Verifies namespace/class/object owner chains, class-field object owners, and static element-access assignment names. |
| Ambient and namespace-only declaration containers | `tests/fixtures/compatibility-matrix/ambient-and-namespace-only` | Verifies declaration-only containers are ignored without inventing functions. |
| Nested functions | `tests/fixtures/compatibility-matrix/nested-functions` | Verifies nested functions are scored independently and do not contribute to their enclosing function. |
| Faux-class wrappers | `tests/fixtures/compatibility-matrix/faux-class-wrapper` | Verifies top-level declarative wrappers do not suppress legitimate exported property-assigned functions. |
| Logical shorthand exclusions | `tests/fixtures/compatibility-matrix/logical-shorthand` | Verifies `??` is ignored and mixed `&&` / `||` sequences reset counting boundaries. |
| Operator semantics | `tests/fixtures/compatibility-matrix/operator-semantics` | Verifies the documented `&&`, `||`, `??`, `?.`, logical assignment, JSX shorthand, ternary, switch/default, and nested-function rules. |
| JSX short-circuit rendering | `tests/fixtures/compatibility-matrix/jsx-short-circuit` | Verifies JSX rendering shorthand is ignored while non-JSX logical control flow is still scored. |
| Labeled jumps | `tests/fixtures/compatibility-matrix/labeled-jumps` | Verifies labeled `break` and `continue` add complexity. |
| Recursion cycles | `tests/fixtures/compatibility-matrix/recursion-cycle` | Verifies direct project-local recursion cycles add the white-paper recursion increment. |

## Derived Rules

The current implementation intentionally treats these forms as shorthand and does not score them directly:

- optional chaining
- nullish coalescing (`??`)
- logical assignment (`??=`, `&&=`, `||=`)
- JSX short-circuit rendering expressions

The current implementation intentionally scores logical `&&` and `||` sequences by transition:

- `a && b && c` adds one logical-operator increment
- `a || b || c` adds one logical-operator increment
- `a && b || c && d` adds one increment for each `&&` / `||` transition boundary
- negated logical groups start a new sequence boundary

The current implementation intentionally treats these forms as independent score roots:

- nested functions
- class-field arrow functions
- object property-assigned functions

See [Cognitive Complexity Operator Semantics](operator-semantics.md) for the cross-tool comparison and rationale.

## Unverified

No additional syntax gaps are currently tracked in this document. If a new TypeScript form is introduced to the analyzer, add a fixture first and then extend this matrix.
