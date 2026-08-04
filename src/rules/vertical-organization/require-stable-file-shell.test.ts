import { RuleTester } from "@typescript-eslint/rule-tester";
import { Linter } from "eslint";
import { afterAll, describe, expect, it, vi } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import { requireStableFileShell as rule } from "./require-stable-file-shell.js";

/* eslint-disable max-lines -- Mutation grammar tables deliberately keep all shell-rule partitions in one specification file. */

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
    { code: `/**\n * @file A stable module.\n * @since 1.0.0\n */\nexport {};` },
    { code: `${overview}\n/** @since 1.0.0 */\nconst value = 1;\nexport { value };` },
    {
      name: "accepts every permitted license prefix and each bounded triple-slash directive spelling",
      code: `// SPDX-License-Identifier: MIT\n// SPDX-FileCopyrightText: Example\n// Copyright Example\n// © Example\n${overview}\n/// <reference path="./types.d.ts" />\n/// <reference types='node'/>\n/// <reference lib="es2022" >\n/// <amd-module name="module-name" />\n/// <amd-dependency path='./dependency'/>\nimport value from "./value";\nexport { value };`,
    },
    {
      name: "keeps independently reasoned bare imports in one import shell",
      code: `${overview}\n// agent-code-guard: side-effect-import-begin -- evaluation-order: first registration\nimport "./first";\n// agent-code-guard: side-effect-import-end -- evaluation-order: first registration\n// agent-code-guard: side-effect-import-begin -- evaluation-order: second registration\nimport "./second";\n// agent-code-guard: side-effect-import-end -- evaluation-order: second registration\nimport value from "./value";\nexport { value };`,
    },
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
      errors: [{ messageId: "duplicateFileTag", line: 2, column: 5, endLine: 2, endColumn: 10 }],
    },
    {
      code: `/** @file    */\nexport {};`,
      output: null,
      errors: [{ messageId: "missingCanonicalFileOverview" }],
    },
    {
      code: `// ordinary comment\n${overview}\nexport {};`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }],
    },
    {
      code: `#!/usr/bin/env node\n// ordinary comment\n${overview}\nexport {};`,
      output: null,
      errors: [{ messageId: "disallowedPreamble", line: 2, column: 1, endLine: 2, endColumn: 1 }],
    },
    {
      code: `#!/usr/bin/env node\n// ordinary comment\n// SPDX-License-Identifier: MIT\n${overview}\nexport {};`,
      output: null,
      errors: [{ messageId: "disallowedPreamble", line: 2, column: 1, endLine: 2, endColumn: 1 }],
    },
    {
      code: `// SPDX-License-Identifier: MIT\nconst before = 1;\n${overview}\nexport {};`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble", line: 2, column: 1, endLine: 2, endColumn: 1 },
        { messageId: "contentBeforeFileOverview", line: 2, column: 1, endLine: 2, endColumn: 1 },
      ],
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
      code: `const before = 1;\n${overview}\nimport value from "./value";\nexport { before, value };`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }, { messageId: "contentBeforeFileOverview" }],
    },
    {
      code: `const before = 1;\n${overview}\n// ordinary comment\nimport value from "./value";\nexport { before, value };`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble" },
        { messageId: "contentBeforeFileOverview" },
        { messageId: "disallowedPreamble" },
      ],
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
      code: `${overview}\n/* /// <reference types="node" /> */\nimport value from "./value";\nexport { value };`,
      output: null,
      errors: [{ messageId: "disallowedPreamble" }],
    },
    {
      code: `${overview}\n"use strict";\nconst ready = true;\nimport value from "./value";\nexport { ready, value };`,
      output: null,
      errors: [{ messageId: "importShellInterrupted" }],
    },
    {
      code: `${overview}\nready;\nimport value from "./value";\nexport { value };`,
      output: null,
      errors: [{ messageId: "importShellInterrupted" }],
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
    {
      name: "rejects license-prefix lookalikes in the preamble",
      code: `// spdx-License-Identifier: MIT\n// Copyrighted Example\n${overview}\nexport {};`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble", line: 1, column: 1, endLine: 1, endColumn: 1 },
      ],
    },
    {
      name: "rejects one-character near misses in triple-slash and barrier marker grammar",
      code: `${overview}\n//// <reference types="node" />\n// agent-code-guard: side-effect-import-begin- -- evaluation-order: registration\nimport "./registration";\n// agent-code-guard: side-effect-import-finish -- evaluation-order: registration`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble" },
        { messageId: "disallowedPreamble" },
        { messageId: "invalidSideEffectImportBarrier" },
        { messageId: "invalidSideEffectImportBarrier" },
      ],
    },
    {
      name: "rejects same-length barrier-prefix impostors",
      code: `${overview}\n// ${"x".repeat(37)}begin -- evaluation-order: registration\nimport "./registration";\n// ${"x".repeat(37)}end -- evaluation-order: registration`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble" },
        { messageId: "invalidSideEffectImportBarrier" },
        { messageId: "invalidSideEffectImportBarrier" },
      ],
    },
    {
      name: "distinguishes absent and malformed barriers on each side",
      code: `${overview}\n/* agent-code-guard: side-effect-import-begin -- evaluation-order: registration */\nimport "./registration";\n// agent-code-guard: side-effect-import-end -- evaluation-order:`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble" },
        { messageId: "missingSideEffectImportBeginBarrier" },
        { messageId: "invalidSideEffectImportBarrier" },
      ],
    },
    {
      name: "requires begin before and end after rather than merely paired markers",
      code: `${overview}\n// agent-code-guard: side-effect-import-end -- evaluation-order: registration\nimport "./registration";\n// agent-code-guard: side-effect-import-begin -- evaluation-order: registration`,
      output: null,
      errors: [
        { messageId: "disallowedPreamble" },
        { messageId: "invalidSideEffectImportBarrier" },
        { messageId: "invalidSideEffectImportBarrier" },
      ],
    },
  ],
});

it("publishes the immutable, non-fixing shell-rule contract", () => {
  expect(rule.meta).toMatchObject({
    type: "problem",
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
    messages: {
      missingCanonicalFileOverview: "File requires exactly one canonical JSDoc @file overview.",
      multipleCanonicalFileOverviews: "File contains more than one canonical JSDoc @file overview.",
      duplicateFileTag: "A canonical JSDoc overview contains more than one @file tag.",
      disallowedPreamble: "Only a byte-zero hashbang and SPDX/copyright comments may precede the @file overview.",
      contentBeforeFileOverview: "Code or an import appears before the canonical @file overview.",
      importShellInterrupted: "Import declarations must form one contiguous shell after the overview preamble.",
      missingSideEffectImportBeginBarrier: "Bare side-effect import requires an immediately preceding evaluation-order begin barrier.",
      missingSideEffectImportEndBarrier: "Bare side-effect import requires an immediately following evaluation-order end barrier.",
      invalidSideEffectImportBarrier: "Side-effect import barriers must use the exact evaluation-order marker grammar.",
      mismatchedSideEffectImportBarrier: "Side-effect import begin and end barriers must state the identical evaluation-order reason.",
    },
  });
});

it("evaluates shell metadata after a fresh module load", async () => {
  vi.resetModules();
  const { requireStableFileShell: freshRule } = await import("./require-stable-file-shell.js");
  expect(freshRule).toMatchObject({
    name: "require-stable-file-shell",
    meta: {
      type: "problem",
      docs: { description: "Requires one canonical @file overview and reasoned hard partitions around bare side-effect imports." },
      schema: [],
      fixable: undefined,
      hasSuggestions: false,
    },
    defaultOptions: [],
  });
  expect(freshRule.meta.docs.url).toBeTypeOf("string");
  expect(freshRule.meta.messages).toEqual(rule.meta.messages);
});

// eslint-disable-next-line max-lines-per-function, complexity, sonarjs/max-lines-per-function -- The closed license/directive grammar is clearest as one data-driven fresh-module partition.
it("evaluates license and directive grammar after a fresh module load", async () => {
  vi.resetModules();
  const { requireStableFileShell: freshRule } = await import("./require-stable-file-shell.js");
  const linter = new Linter();
  const verify = (code: string) => linter.verify(code, {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { guard: { rules: { shell: freshRule } } },
    rules: { "guard/shell": "error" },
  }, { filename: "fresh.ts" });
  for (const license of [
    "// SPDX-License-Identifier: MIT",
    "//Copyright Example",
    "// SPDX-FileCopyrightText: Example",
    "// Copyright Example",
    "// © Example",
    "/*Copyright Example*/",
    "/*\n * SPDX-License-Identifier: MIT\n */",
    "/*\n *\n * SPDX-License-Identifier: MIT\n */",
    "/*\n*Copyright Example\n*/",
  ]) {
    expect(verify(`${license}\n${overview}\nexport {};`)).toEqual([]);
  }
  for (const lookalike of ["// note Copyright Example", "/* note Copyright Example */"]) {
    expect(verify(`${lookalike}\n${overview}\nexport {};`)[0]?.messageId).toBe("disallowedPreamble");
  }
  expect(verify(`${overview}\n// SPDX-License-Identifier: MIT\nexport {};`)).toEqual([]);
  expect(verify(`//\n${overview}\nexport {};`)[0]?.messageId).toBe("disallowedPreamble");
  for (const directive of [
    `/// <reference path="./types.d.ts" />`,
    `/// <reference  path="./types.d.ts" />`,
    `///<reference types='node'>`,
    `/// <reference lib="es2022" >`,
    `/// <amd-module name="module-name" />`,
    `/// <amd-module  name="module-name" />`,
    `/// <amd-module name='module-name' />`,
    `/// <amd-dependency path='./dependency'/>`,
    `/// <amd-dependency  path="./dependency"/>   `,
  ]) {
    expect(verify(`${overview}\n${directive}\nimport value from "./value";\nexport { value };`)).toEqual([]);
  }
  for (const directive of [
    `//// <reference types="node" />`,
    `///x<reference types="node" />`,
    `/// <referencepath="./types.d.ts" />`,
    `/// <amd-modulename="module-name" />`,
    `/// <amd-dependencypath='./dependency'/>`,
    `/// <amd-module name="module-name" /> trailing`,
    `/// <amd-dependency path='./dependency'/> trailing`,
  ]) {
    expect(verify(`${overview}\n${directive}\nimport value from "./value";\nexport { value };`)[0]?.messageId).toBe("disallowedPreamble");
  }
  expect(verify(`/** @file */\nexport {};`).map((message) => message.messageId)).toEqual([
    "missingCanonicalFileOverview",
  ]);
  expect(verify(`/**/\nexport {};`).map((message) => message.messageId)).toEqual([
    "missingCanonicalFileOverview",
  ]);
  expect(verify(`/** @file First.\n * @file Second. */\nexport {};`).map((message) => message.messageId)).toEqual([
    "duplicateFileTag",
    "missingCanonicalFileOverview",
  ]);
  expect(verify(`${overview}\n/* /// <reference types="node" /> */\nimport value from "./value";\nexport { value };`)[0]?.messageId).toBe("disallowedPreamble");
  expect(verify(`${overview}\nimport first from "./first";\nconst ready = first;\nimport later from "./later";`).map((message) => message.messageId)).toContain("importShellInterrupted");
  expect(verify(`const before = 1;\n${overview}\n// agent-code-guard: side-effect-import-begin -- evaluation-order: registration\nimport "./registration";\n// agent-code-guard: side-effect-import-end -- evaluation-order: registration`).map((message) => message.messageId)).toEqual([
    "disallowedPreamble",
    "contentBeforeFileOverview",
  ]);
});

/* eslint-enable max-lines -- End of the deliberately co-located mutation grammar tables. */
