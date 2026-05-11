import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./tag-discriminant.js";

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
      // `_tag` is accessed via computed string — not a static `_tag` member.
      code: 'if (ctx.error["_tag"] === "WebhookTimeoutError") return;',
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
    {
      // Manual Option `_tag` check — Match.tag("Some") / Match.tag("None") instead.
      code: 'if (opt._tag === "None") return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      // Manual tagged-union check — Match.discriminator("_tag") / Match.tag instead.
      code: 'if (event._tag === "message.sent") return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      // Manual tagged-union switch — Match.value(...).pipe(Match.tag(...)).
      code: 'switch (result._tag) { case "Ready": return; default: return; }',
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      // Even when the parent is computed, the `_tag` access is static.
      code: 'if (ctx["error"]._tag === "WebhookTimeoutError") return;',
      errors: [{ messageId: "tagDiscriminant" }],
    },
  ],
});
