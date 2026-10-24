export function ignored(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean): number {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) return 1;
        }
      }
    }
  }
  return 0;
}
