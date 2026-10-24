export function risky(a: boolean, b: boolean, c: boolean, d: boolean): number {
  if (a) {
    if (b) {
      if (c) {
        if (d) return 1;
      }
    }
  }
  return 0;
}
