import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import { requireStableFileShell as rule } from "./require-stable-file-shell.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
});

const overview = `/** @file A stable test module. */`;
const pairedBareImport = `// agent-code-guard: side-effect-import-begin -- evaluation-order: registration initializes the runtime\nimport "./registration";\n// agent-code-guard: side-effect-import-end -- evaluation-order: registration initializes the runtime`;

ruleTester.run("require-stable-file-shell", rule, {
  valid: [
    { code: `${overview}\nexport {};` },
    { code: `#!/usr/bin/env node\n// SPDX-License-Identifier: MIT\n/* Copyright Example */\n${overview}\n/// <reference types="node" />\n"use strict";\nimport value from "./value";\n${pairedBareImport}\nexport { value };` },
    { code: `/*\r\n * SPDX-License-Identifier: MIT\r\n */\r\n${overview}\r\nexport {};` },
    { code: `${overview}\n${pairedBareImport}\nimport value from "./value";\nexport { value };` },
    { code: `${overview}\nimport type { Value } from "./value";\nexport type { Value };` },
  ],
  invalid: [
    {
      code: `/** @file First overview. */\n/** @file Second overview. */\nexport {};`,
      output: null,
      errors: [{ messageId: "multipleCanonicalFileOverviews" }],
    },
    {
      code: `/**\n * @file First overview.\n * @file Second overview.\n */\nexport {};`,
      output: null,
      errors: [{ messageId: "duplicateFileTag" }, { messageId: "missingCanonicalFileOverview" }],
    },
    {
      code: `/** @file Canonical overview. */\n/** @file */\nexport {};`,
      output: null,
      errors: [{ messageId: "duplicateFileTag" }],
    },
    {
      code: `// ordinary comment\n${overview}\nexport {};`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }],
    },
    {
      code: `const before = 1;\n${overview}\nexport {};`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }, { messageId: "contentBeforeFileOverview" }],
    },
    {
      code: `import value from "./value";\n${overview}\nexport { value };`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }, { messageId: "contentBeforeFileOverview" }],
    },
    {
      code: `\uFEFF${overview}\nexport {};`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }],
    },
    {
      code: `${overview}\nimport first from "./first";\nconst ready = first;\nimport later from "./later";\nexport { ready, later };`,
      output: null,
      errors: [{ messageId: "importShellInterrupted" }],
    },
    {
      code: `${overview}\n// ordinary comment\nimport value from "./value";\nexport { value };`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }],
    },
    {
      code: `${overview}\nimport "./registration";\nexport {};`,
      output: null,
      errors: [
        { messageId: "missingSideEffectImportBeginBarrier" },
        { messageId: "missingSideEffectImportEndBarrier" },
      ],
    },
    {
      code: `${overview}\n// agent-code-guard: side-effect-import-begin -- evaluation-order:   \nimport "./registration";\n// agent-code-guard: side-effect-import-end -- evaluation-order: registration`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble" },
        { messageId: "invalidSideEffectImportBarrier" },
      ],
    },
    {
      code: `${overview}\n// agent-code-guard: side-effect-import-begin -- evaluation-order: registration\nimport value from "./value";\nexport { value };`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }],
    },
    {
      code: `${overview}\n// agent-code-guard: side-effect-import-end -- evaluation-order: registration\nimport value from "./value";\nexport { value };`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }],
    },
    {
      code: `${overview}\n// agent-code-guard: side-effect-import-begin -- evaluation-order: first reason\nimport "./registration";\n// agent-code-guard: side-effect-import-end -- evaluation-order: second reason`,
      output: null,
      errors: [{ messageId: "mismatchedSideEffectImportBarrier" }],
    },
    {
      code: `${overview}\n// agent-code-guard: side-effect-import-begin -- evaluation-order: registration\n\nimport "./registration";\n// agent-code-guard: side-effect-import-end -- evaluation-order: registration`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble" },
        { messageId: "invalidSideEffectImportBarrier" },
      ],
    },
    {
      code: `${overview}\n// unrelated comment\nimport "./registration";\n// unrelated comment`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble" },
        { messageId: "invalidSideEffectImportBarrier" },
        { messageId: "invalidSideEffectImportBarrier" },
      ],
    },
  ],
});
