export function andRun(a: boolean, b: boolean, c: boolean, d: boolean): boolean {
  return a && b && c && d;
}

export function orRun(a: boolean, b: boolean, c: boolean, d: boolean): boolean {
  return a || b || c || d;
}

export function mixedTransitions(a: boolean, b: boolean, c: boolean, d: boolean): boolean {
  return a && b || c && d;
}

export function defaultNullish(value?: string): string {
  const label = value ?? "";
  return label;
}

export function nonDefaultNullish(left?: string, right?: string): string | undefined {
  return left ?? right;
}

export function optionalAccess(input?: { user?: { name?: string } }): string | undefined {
  return input?.user?.name;
}

export function logicalAssignments(left: boolean | undefined, right: boolean): boolean | undefined {
  left &&= right;
  left ||= right;
  left ??= right;
  return left;
}

export function negatedGroup(a: boolean, b: boolean, c: boolean): number {
  if (a && !(b && c)) {
    return 1;
  }
  return 0;
}

export function nestedTernary(a: boolean, b: boolean, c: boolean): number {
  return a ? (b ? 1 : 2) : c ? 3 : 4;
}

export function switchDefault(value: string): number {
  switch (value) {
    default:
      return 0;
  }
}

export function outer(a: boolean, b: boolean): boolean {
  const inner = () => a && b;
  return inner();
}
