const { safe } = require("../src/safe");

test("consumer source executes", () => {
  expect(safe(true)).toBe(1);
});
