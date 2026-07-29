/**
 * @file Maintained-rule mappings for mechanically enforceable clauses in the
 * Google TypeScript Style Guide. Formatting rules are intentionally absent.
 */

import type { TSESLint } from "@typescript-eslint/utils";

type RuleEntry = TSESLint.Linter.RuleEntry;

/**
 * Core ESLint rules that enforce Google TypeScript language and safety
 * requirements without imposing formatter policy.
 */
export const googleCoreRuleEntries: Record<string, RuleEntry> = {
  "accessor-pairs": ["error", { enforceForClassMembers: true, setWithoutGet: true }],
  "array-callback-return": "error",
  "block-scoped-var": "error",
  "constructor-super": "error",
  curly: ["error", "all"],
  "default-case": "error",
  "default-case-last": "error",
  "default-param-last": "off",
  "dot-notation": "off",
  eqeqeq: ["error", "always", { null: "ignore" }],
  "for-direction": "error",
  "getter-return": "error",
  "guard-for-in": "error",
  "new-parens": "error",
  "no-array-constructor": "off",
  "no-async-promise-executor": "error",
  "no-caller": "error",
  "no-class-assign": "error",
  "no-compare-neg-zero": "error",
  "no-cond-assign": ["error", "except-parens"],
  "no-const-assign": "error",
  "no-constant-binary-expression": "error",
  "no-constant-condition": "error",
  "no-constructor-return": "error",
  "no-control-regex": "error",
  "no-debugger": "error",
  "no-dupe-args": "error",
  "no-dupe-class-members": "error",
  "no-dupe-else-if": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-empty": ["error", { allowEmptyCatch: false }],
  "no-empty-character-class": "error",
  "no-empty-pattern": "error",
  "no-empty-static-block": "error",
  "no-eval": "error",
  "no-ex-assign": "error",
  "no-extend-native": "error",
  "no-extra-boolean-cast": "error",
  "no-fallthrough": [
    "error",
    {
      allowEmptyCase: true,
      commentPattern: "falls?\\s?through",
      reportUnusedFallthroughComment: true,
    },
  ],
  "no-func-assign": "error",
  "no-global-assign": "error",
  "no-implied-eval": "off",
  "no-import-assign": "error",
  "no-invalid-regexp": "error",
  "no-invalid-this": "off",
  "no-iterator": "error",
  "no-loop-func": "off",
  "no-loss-of-precision": "off",
  "no-new-func": "error",
  "no-new-native-nonconstructor": "error",
  "no-new-symbol": "error",
  "no-new-wrappers": "error",
  "no-obj-calls": "error",
  "no-object-constructor": "error",
  "no-promise-executor-return": "error",
  "no-proto": "error",
  "no-prototype-builtins": "error",
  "no-redeclare": "off",
  "no-restricted-syntax": [
    "error",
    {
      message:
        "Do not define or apply decorators; Agent Code Guard uses the stricter framework-independent Google Style variant.",
      selector: "Decorator",
    },
    {
      message:
        "Do not use const enums; their inlining behavior is incompatible with isolated modules.",
      selector: "TSEnumDeclaration[const=true]",
    },
  ],
  "no-return-assign": ["error", "always"],
  "no-self-assign": "error",
  "no-self-compare": "error",
  "no-sequences": "error",
  "no-setter-return": "error",
  "no-shadow": "off",
  "no-shadow-restricted-names": "error",
  "no-sparse-arrays": "error",
  "no-this-before-super": "error",
  "no-throw-literal": "off",
  "no-unmodified-loop-condition": "error",
  "no-unreachable": "error",
  "no-unreachable-loop": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "no-unsafe-optional-chaining": "error",
  "no-unused-expressions": "off",
  "no-unused-labels": "error",
  "no-unused-private-class-members": "error",
  "no-unused-vars": "off",
  "no-use-before-define": "off",
  "no-useless-backreference": "error",
  "no-useless-catch": "error",
  "no-useless-constructor": "off",
  "no-useless-escape": "error",
  "no-var": "error",
  "no-with": "error",
  "one-var": ["error", "never"],
  "prefer-arrow-callback": ["error", { allowNamedFunctions: false }],
  "prefer-const": ["error", { destructuring: "all" }],
  "prefer-object-has-own": "error",
  "prefer-promise-reject-errors": "off",
  "prefer-rest-params": "error",
  "prefer-spread": "error",
  radix: ["error", "always"],
  "require-atomic-updates": "error",
  "require-await": "off",
  "use-isnan": ["error", { enforceForIndexOf: true, enforceForSwitchCase: true }],
  "valid-typeof": ["error", { requireStringLiterals: true }],
};

/**
 * Import rules that enforce stable named module surfaces without dictating
 * import ordering or other formatter-owned concerns.
 */
export const googleImportRuleEntries: Record<string, RuleEntry> = {
  "import-x/no-absolute-path": "error",
  "import-x/no-amd": "error",
  "import-x/no-commonjs": "error",
  "import-x/no-cycle": ["error", { allowUnsafeDynamicCyclicDependency: false }],
  "import-x/no-default-export": "error",
  "import-x/no-duplicates": ["error", { "prefer-inline": true }],
  "import-x/no-dynamic-require": "error",
  "import-x/no-empty-named-blocks": "error",
  "import-x/no-mutable-exports": "error",
  "import-x/no-named-default": "error",
  "import-x/no-self-import": "error",
  "import-x/no-useless-path-segments": ["error", { commonjs: false }],
};

/**
 * Directive-comment rules that require scoped suppressions with durable
 * explanations and reject stale or unlimited disables.
 */
export const googleDirectiveCommentRuleEntries: Record<string, RuleEntry> = {
  "@eslint-community/eslint-comments/disable-enable-pair": ["error", { allowWholeFile: false }],
  "@eslint-community/eslint-comments/no-aggregating-enable": "error",
  "@eslint-community/eslint-comments/no-duplicate-disable": "error",
  "@eslint-community/eslint-comments/no-unlimited-disable": "error",
  "@eslint-community/eslint-comments/no-unused-disable": "error",
  "@eslint-community/eslint-comments/no-unused-enable": "error",
  "@eslint-community/eslint-comments/require-description": ["error", { ignore: [] }],
};
