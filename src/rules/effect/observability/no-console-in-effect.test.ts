import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./no-console-in-effect.js";

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

ruleTester.run("no-console-in-effect", rule, {
  valid: [
    // No effect import: console.* is fine
    {
      code: `
        import { something } from "lodash";
        console.log("hello");
      `,
    },
    // Effect imported but no console calls
    {
      code: `
        import { Effect } from "effect";
        const program = Effect.succeed(1);
      `,
    },
    // Effect imported and Effect.log used (not console)
    {
      code: `
        import { Effect } from "effect";
        const program = Effect.log("info");
      `,
    },
    // CLI file: console allowed even with effect import
    {
      code: `
        import { Effect } from "effect";
        console.log("startup");
      `,
      filename: "src/cli/index.ts",
    },
    // bin file: console allowed
    {
      code: `
        import { Effect } from "effect";
        console.error("bootstrap failed");
      `,
      filename: "bin/run.ts",
    },
    // file named cli.ts at any depth
    {
      code: `
        import { Effect } from "effect";
        console.log("hi");
      `,
      filename: "src/foo/cli.ts",
    },
    // @effect/* import without console
    {
      code: `
        import { FileSystem } from "@effect/platform";
        const fs = FileSystem;
      `,
    },
  ],
  invalid: [
    // Effect imported, console.log used outside CLI files
    {
      code: `
        import { Effect } from "effect";
        console.log("oops");
      `,
      errors: [{ messageId: "consoleInEffect", data: { method: "log" } }],
    },
    // @effect/platform imported, console.error used
    {
      code: `
        import { FileSystem } from "@effect/platform";
        console.error("nope");
      `,
      errors: [{ messageId: "consoleInEffect", data: { method: "error" } }],
    },
    // Multiple console calls all flagged
    {
      code: `
        import { Effect } from "effect";
        console.warn("a");
        console.info("b");
      `,
      errors: [
        { messageId: "consoleInEffect", data: { method: "warn" } },
        { messageId: "consoleInEffect", data: { method: "info" } },
      ],
    },
    // Side-effect-only import of effect still triggers
    {
      code: `
        import "effect";
        console.debug("hi");
      `,
      errors: [{ messageId: "consoleInEffect", data: { method: "debug" } }],
    },
  ],
});
