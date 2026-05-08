import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./handler-requires-span.js";

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

ruleTester.run("handler-requires-span", rule, {
  valid: [
    // Non-handler file: rule does not run
    {
      code: `
        export const program = Effect.gen(function* () {
          return yield* load;
        });
      `,
      filename: "src/feature/program.ts",
    },
    // Handler file with withSpan inline
    {
      code: `
        export const handleRequest = Effect.gen(function* () {
          return yield* Effect.withSpan("handleRequest")(load);
        });
      `,
      filename: "src/handlers/request.ts",
    },
    // Handler file with withSpan via pipe
    {
      code: `
        export const handleRequest = Effect.gen(function* () {
          return yield* load;
        }).pipe(Effect.withSpan("handleRequest"));
      `,
      filename: "src/handlers/request.ts",
    },
    // Handler-suffixed file with withSpan
    {
      code: `
        export const userHandler = Effect.gen(function* () {
          return yield* Effect.withSpan("userHandler")(load);
        });
      `,
      filename: "src/user-handler.ts",
    },
    // Handler file with no Effect.gen — rule has nothing to flag
    {
      code: `export const PORT = 8080;`,
      filename: "src/handlers/config.ts",
    },
  ],
  invalid: [
    // Handler file with bare Effect.gen
    {
      code: `
        export const handleRequest = Effect.gen(function* () {
          return yield* load;
        });
      `,
      filename: "src/handlers/request.ts",
      errors: [{ messageId: "handlerMissingSpan" }],
    },
    // Routes folder
    {
      code: `
        export const routeUsers = Effect.gen(function* () {
          return yield* render;
        });
      `,
      filename: "src/routes/users.ts",
      errors: [{ messageId: "handlerMissingSpan" }],
    },
    // *-handler.ts file
    {
      code: `
        export const send = Effect.gen(function* () {
          yield* publish;
        });
      `,
      filename: "src/notification-handler.ts",
      errors: [{ messageId: "handlerMissingSpan" }],
    },
    // Pipe doesn't include withSpan
    {
      code: `
        export const handleRequest = Effect.gen(function* () {
          return yield* load;
        }).pipe(Effect.tap(log));
      `,
      filename: "src/handlers/request.ts",
      errors: [{ messageId: "handlerMissingSpan" }],
    },
  ],
});
