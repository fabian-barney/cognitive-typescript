import { second } from "./b";

export function first(flag: boolean): number {
  if (flag) {
    return second(false);
  }
  return 0;
}
