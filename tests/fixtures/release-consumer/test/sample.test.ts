import { expect, test } from "vitest";
import { safe } from "../src/safe";

test("consumer source executes", () => {
  expect(safe(true)).toBe(1);
});
