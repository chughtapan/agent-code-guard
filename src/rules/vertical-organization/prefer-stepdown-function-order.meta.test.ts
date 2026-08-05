import { expect, test, vi } from "vitest";

test("stepdown rule exposes its exact public metadata", async () => {
  vi.resetModules();
  const { preferStepdownFunctionOrder: rule } = await import("./prefer-stepdown-function-order.js");
  expect(rule.name).toBe("prefer-stepdown-function-order");
  expect(rule.meta).toMatchObject({
    type: "suggestion",
    docs: {
      description: "Keep exported functions and visible class methods before internal implementation detail, then keep direct callers before their local callees.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#5-discipline-over-capability",
    },
    messages: {
      declarationOutOfStoryBand: "{{name}} belongs to the {{currentBand}} story band, which must precede an earlier {{previousBand}} declaration.",
      callerMustPrecedeCallee: "{{caller}} must precede its direct local callee {{callee}} in the {{band}} story band.",
      cyclicCallerMustPrecedeCallee: "{{caller}} and {{blocker}} form a declaration cycle that must precede their direct local callee {{callee}} in the {{band}} story band.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  });
});
