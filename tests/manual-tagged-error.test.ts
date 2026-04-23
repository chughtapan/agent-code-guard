import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/manual-tagged-error.js";

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

ruleTester.run("manual-tagged-error", rule, {
  valid: [
    {
      code: 'class RunError extends Data.TaggedError("RunError")<{}> {}',
    },
    {
      code: 'type TelemetryEvent = { readonly _tag: "RunStarted"; readonly id: string };',
    },
    {
      code: 'type TelemetryEvent = { readonly "_tag": "RunStarted"; readonly id: string } & { readonly at: number };',
    },
    {
      code: "interface RpcFailure { readonly message: string; }",
    },
    {
      code: "type RpcFailure = { readonly message: string };",
    },
    {
      code: 'interface Player { readonly _tag: "Player"; readonly id: string; }',
    },
    {
      code: 'class Outcome { readonly _tag = "SpawnFailed" as const; }',
    },
    {
      code: 'function logFailure() { log({ _tag: "ParseFailure", path, message }); }',
    },
    {
      code: 'class Session extends errors["AppError"] { readonly _tag = "BadToken" as const; }',
    },
    {
      code: 'class Session extends errors.Service { readonly _tag = "BadToken" as const; }',
    },
    {
      code: 'const parse = () => { Effect["fail"]({ _tag: "ParseFailure", path, message }); };',
    },
    {
      code: 'const err = new errors["PlannedHarnessIngressError"]({ cause: { _tag: "ParseFailure", path, message } });',
    },
    {
      code: 'function outer() { return function inner() { const tagged = { _tag: "ParseFailure", path, message }; return tagged; }; }',
    },
    {
      code: 'const wrap = () => new Error(() => { const tagged = { _tag: "ParseFailure", path, message }; return tagged; });',
    },
    {
      code: 'const make = () => ({ _tag: "Player", id });',
    },
    {
      code: 'const err = new PlannedHarnessIngressError({ cause: ParseFailure({ path, message }) });',
    },
    {
      code: "// eslint-disable-next-line @rule-tester/manual-tagged-error -- suppression test\ntype RpcFailure = { readonly _tag: 'RpcFailure'; readonly message: string };",
    },
  ],
  invalid: [
    {
      code: 'class RunError extends Error { readonly _tag = "RunError" as const; }',
      errors: [{ messageId: "manualTaggedError", data: { name: "RunError" } }],
    },
    {
      code: 'class RunError extends Error { readonly [`_tag`] = "RunError" as const; }',
      errors: [{ messageId: "manualTaggedError", data: { name: "RunError" } }],
    },
    {
      code: 'class SpawnFailed extends Error { readonly _tag = "SpawnFailed" as const; }',
      errors: [
        { messageId: "manualTaggedError", data: { name: "SpawnFailed" } },
      ],
    },
    {
      code: 'class BadToken extends AppError { readonly _tag = "BadToken" as const; }',
      errors: [
        { messageId: "manualTaggedError", data: { name: "BadToken" } },
      ],
    },
    {
      code: 'class Session extends errors.AppError { readonly _tag = "BadToken" as const; }',
      errors: [
        { messageId: "manualTaggedError", data: { name: "Session" } },
      ],
    },
    {
      code: "type MoltAmountError = { readonly _tag: 'NotInteger'; readonly value: number } | { readonly _tag: 'Negative'; readonly value: number };",
      errors: [
        { messageId: "manualTaggedError", data: { name: "MoltAmountError" } },
      ],
    },
    {
      code: "interface RpcFailure { readonly _tag: 'RpcFailure'; readonly message: string; }",
      errors: [
        { messageId: "manualTaggedError", data: { name: "RpcFailure" } },
      ],
    },
    {
      code: "interface RpcFailure { readonly '_tag': 'RpcFailure'; readonly message: string; }",
      errors: [
        { messageId: "manualTaggedError", data: { name: "RpcFailure" } },
      ],
    },
    {
      code: 'const ErrorCtor = class extends Error { readonly "_tag" = "RunError" as const; };',
      errors: [
        { messageId: "manualTaggedError", data: { name: "(anonymous class)" } },
      ],
    },
    {
      code: 'class Session extends errors.AppError { readonly ["_tag"] = "BadToken" as const; }',
      errors: [
        { messageId: "manualTaggedError", data: { name: "Session" } },
      ],
    },
    {
      code: "type RpcFailure = { readonly '_tag': 'RpcFailure'; readonly message: string } & { readonly cause: unknown };",
      errors: [
        { messageId: "manualTaggedError", data: { name: "RpcFailure" } },
      ],
    },
    {
      code: "type RpcFailure = { readonly '_tag': 'RpcFailure'; readonly message: string } | { readonly cause: unknown };",
      errors: [
        { messageId: "manualTaggedError", data: { name: "RpcFailure" } },
      ],
    },
    {
      code: 'function parse() { return { _tag: "ParseFailure", path, message }; }',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
    {
      code: 'const parse = () => ({ _tag: "ParseFailure", path, message });',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
    {
      code: 'function parse() { return { ["_tag"]: "ParseFailure", path, message }; }',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
    {
      code: 'const parse = () => new PlannedHarnessIngressError({ cause: { _tag: "ParseFailure", path, message } });',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
    {
      code: 'const parse = () => new Error({ cause: { _tag: "ParseFailure", path, message } });',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
    {
      code: 'const err = new errors.PlannedHarnessIngressError({ cause: { _tag: "ParseFailure", path, message } });',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
    {
      code: 'const parse = () => Effect.fail({ _tag: "ParseFailure", path, message });',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
    {
      code: 'const parse = () => Effect.fail({ ["_tag"]: "ParseFailure", path, message });',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
    {
      code: 'function parse() { Effect.fail({ _tag: "ParseFailure", path, message }); }',
      errors: [
        { messageId: "manualTaggedError", data: { name: "ParseFailure" } },
      ],
    },
  ],
});
