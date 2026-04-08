export function findFirstEven(groups: number[][]): number {
  outer: for (const group of groups) {
    if (group.some((value) => value % 2 === 0)) {
      continue outer;
    }
  }
  return 0;
}
