export function safeDefaults(input?: { label?: string }, fallback?: string): string {
  return input?.label ?? fallback ?? "missing";
}

export function mixed(flagA: boolean, flagB: boolean, flagC: boolean): number {
  if (flagA || flagB && flagC) {
    return 1;
  }
  return 0;
}
