import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/tag-discriminant.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
});

ruleTester.run("tag-discriminant", rule, {
  valid: [
    {
      code: 'const out = Effect.catchTag("WebhookTimeoutError", () => Effect.void)(program);',
    },
    {
      code: 'if (opt._tag === "None") return;',
    },
    {
      code: 'if (event._tag === "message.sent") return;',
    },
    {
      code: 'if (ctx["error"]._tag === "WebhookTimeoutError") return;',
    },
    {
      code: 'if (ctx.error["_tag"] === "WebhookTimeoutError") return;',
    },
    {
      code: 'switch (result._tag) { case "Ready": return; default: return; }',
    },
    {
      code: 'const decorated = err._tag + "WebhookTimeoutError";',
    },
    {
      code: 'if (err._tag === other._tag) return;',
    },
    {
      code: 'if (err._tag === expectedTag) return;',
    },
    {
      code: 'switch (err._tag) { default: return; }',
    },
    {
      code: 'if (err.name === "TimeoutError") return;',
    },
    {
      code: "// eslint-disable-next-line @rule-tester/tag-discriminant -- suppression test\nif (err._tag === 'WebhookTimeoutError') return;",
    },
  ],
  invalid: [
    {
      code: 'if (err._tag === "AttestationTimeout") return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'if (error._tag !== "WebhookTimeoutError") return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'const timedOut = lastError._tag === "RpcTimeoutError";',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'if ("WebhookTimeoutError" === err._tag) return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'if (ctx.error._tag === "WebhookTimeoutError") return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'if (ctx.error?._tag === "WebhookTimeoutError") return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'if (ctx?.error._tag === "WebhookTimeoutError") return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'switch (err._tag) { case "SkillAttestation": return; default: return; }',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'switch (ctx.error._tag) { case "WebhookTimeoutError": return; default: return; }',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'switch (ctx.error?._tag) { case "WebhookTimeoutError": return; default: return; }',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      code: 'switch (ctx?.error._tag) { case "WebhookTimeoutError": return; default: return; }',
      errors: [{ messageId: "tagDiscriminant" }],
    },
  ],
});
