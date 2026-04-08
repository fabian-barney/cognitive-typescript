import { first } from "./a";

export function second(flag: boolean): number {
  if (flag) {
    return first(false);
  }
  return 0;
}
