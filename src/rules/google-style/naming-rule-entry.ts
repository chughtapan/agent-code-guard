/**
 * @file Google-style TypeScript-ESLint naming configuration.
 */

import type { TSESLint } from "@typescript-eslint/utils";

/**
 * Naming-convention entry used by both main presets.
 *
 * Function-valued variables permit PascalCase here so the companion
 * component-function-naming rule can distinguish actual TSX components from
 * ordinary functions using syntax and JSX references.
 */
export const googleNamingConventionRule: TSESLint.Linter.RuleEntry = [
  "error",
  {
    format: null,
    modifiers: ["requiresQuotes"],
    selector: "default",
  },
  {
    filter: {
      match: true,
      regex: "^_tag$",
    },
    format: null,
    selector: ["classProperty", "objectLiteralProperty", "typeProperty"],
  },
  {
    format: null,
    selector: "default",
  },
  {
    format: null,
    modifiers: ["destructured"],
    selector: "variable",
  },
  {
    format: ["camelCase", "PascalCase", "UPPER_CASE"],
    leadingUnderscore: "forbid",
    selector: "variable",
    trailingUnderscore: "forbid",
    types: ["function"],
  },
  {
    format: ["camelCase", "UPPER_CASE"],
    leadingUnderscore: "forbid",
    modifiers: ["const", "global"],
    selector: "variable",
    trailingUnderscore: "forbid",
  },
  {
    format: ["camelCase"],
    leadingUnderscore: "forbid",
    selector: "variable",
    trailingUnderscore: "forbid",
  },
  {
    format: ["camelCase", "PascalCase"],
    leadingUnderscore: "forbid",
    selector: "function",
    trailingUnderscore: "forbid",
  },
  {
    format: ["camelCase"],
    leadingUnderscore: "forbid",
    selector: "parameter",
    trailingUnderscore: "forbid",
  },
  {
    format: ["camelCase", "UPPER_CASE"],
    leadingUnderscore: "forbid",
    modifiers: ["readonly", "static"],
    selector: "classProperty",
    trailingUnderscore: "forbid",
  },
  {
    format: ["camelCase"],
    leadingUnderscore: "forbid",
    selector: "classProperty",
    trailingUnderscore: "forbid",
  },
  {
    format: ["camelCase"],
    leadingUnderscore: "forbid",
    selector: "typeProperty",
    trailingUnderscore: "forbid",
  },
  {
    format: ["camelCase"],
    leadingUnderscore: "forbid",
    selector: ["classMethod", "typeMethod", "accessor"],
    trailingUnderscore: "forbid",
  },
  {
    format: null,
    selector: ["objectLiteralMethod", "objectLiteralProperty"],
  },
  {
    format: ["PascalCase"],
    selector: "typeLike",
  },
  {
    format: ["PascalCase"],
    selector: "typeParameter",
  },
  {
    format: ["UPPER_CASE"],
    selector: "enumMember",
  },
];
