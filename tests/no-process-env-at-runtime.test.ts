import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-process-env-at-runtime.js";

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

ruleTester.run("no-process-env-at-runtime", rule, {
  valid: [
    {
      code: "const env = runtime.process.env.PORT;",
    },
    {
      code: "const process = { env: { PORT: '3000' } };\nconst port = process.env.PORT;",
    },
    {
      code: "const process = require('./process-shim');\nconst port = process.env.PORT;",
    },
    {
      code: "const port = yield* Config.string('PORT');",
    },
    {
      code: "// eslint-disable-next-line @rule-tester/no-process-env-at-runtime -- suppression test\nconst port = process.env.PORT;",
    },
  ],
  invalid: [
    {
      code: "const port = process.env.PORT;",
      errors: [{ messageId: "noProcessEnvAtRuntime" }],
    },
    {
      code: "const { PORT } = process.env;",
      errors: [{ messageId: "noProcessEnvAtRuntime" }],
    },
    {
      code: "const port = process['env']['PORT'];",
      errors: [{ messageId: "noProcessEnvAtRuntime" }],
    },
    {
      code: "Object.keys(process.env);",
      errors: [{ messageId: "noProcessEnvAtRuntime" }],
    },
    {
      code: "process.env['LOG_LEVEL'] = 'info';",
      errors: [{ messageId: "noProcessEnvAtRuntime" }],
    },
    {
      code: "import process from 'node:process';\nconst port = process.env.PORT;",
      errors: [{ messageId: "noProcessEnvAtRuntime" }],
    },
    {
      code: "const process = require('node:process');\nconst port = process.env.PORT;",
      errors: [{ messageId: "noProcessEnvAtRuntime" }],
    },
  ],
});
