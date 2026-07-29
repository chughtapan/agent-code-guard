/**
 * @file TypeScript-ESLint mappings for mechanically enforceable clauses in
 * the Google TypeScript Style Guide and stricter Agent Code Guard doctrine.
 */

import type { TSESLint } from "@typescript-eslint/utils";

type RuleEntry = TSESLint.Linter.RuleEntry;

/**
 * TypeScript-ESLint rules that enforce type-system and typed semantic clauses.
 */
export const googleTypeScriptRuleEntries: Record<string, RuleEntry> = {
  "@typescript-eslint/array-type": ["error", { default: "array-simple", readonly: "array-simple" }],
  "@typescript-eslint/await-thenable": "error",
  "@typescript-eslint/ban-ts-comment": [
    "error",
    {
      minimumDescriptionLength: 10,
      "ts-check": false,
      "ts-expect-error": true,
      "ts-ignore": true,
      "ts-nocheck": true,
    },
  ],
  "@typescript-eslint/consistent-generic-constructors": ["error", "constructor"],
  "@typescript-eslint/consistent-type-assertions": [
    "error",
    {
      arrayLiteralTypeAssertions: "never",
      assertionStyle: "as",
      objectLiteralTypeAssertions: "never",
    },
  ],
  "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
  "@typescript-eslint/consistent-type-exports": [
    "error",
    { fixMixedExportsWithInlineTypeSpecifier: true },
  ],
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      disallowTypeAnnotations: true,
      fixStyle: "inline-type-imports",
      prefer: "type-imports",
    },
  ],
  "@typescript-eslint/default-param-last": "error",
  "@typescript-eslint/dot-notation": ["error", { allowKeywords: true }],
  "@typescript-eslint/naming-convention": [
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
      format: ["camelCase"],
      leadingUnderscore: "forbid",
      selector: ["function", "parameter"],
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
  ],
  "@typescript-eslint/no-array-constructor": "error",
  "@typescript-eslint/no-base-to-string": "error",
  "@typescript-eslint/no-confusing-non-null-assertion": "error",
  "@typescript-eslint/no-confusing-void-expression": [
    "error",
    { ignoreArrowShorthand: false, ignoreVoidOperator: false },
  ],
  "@typescript-eslint/no-deprecated": "error",
  "@typescript-eslint/no-duplicate-enum-values": "error",
  "@typescript-eslint/no-duplicate-type-constituents": "error",
  "@typescript-eslint/no-dynamic-delete": "error",
  "@typescript-eslint/no-empty-object-type": [
    "error",
    { allowInterfaces: "with-single-extends", allowObjectTypes: "never" },
  ],
  "@typescript-eslint/no-explicit-any": ["error", { fixToUnknown: true, ignoreRestArgs: false }],
  "@typescript-eslint/no-extraneous-class": [
    "error",
    { allowConstructorOnly: false, allowEmpty: false, allowStaticOnly: false },
  ],
  "@typescript-eslint/no-extra-non-null-assertion": "error",
  "@typescript-eslint/no-floating-promises": [
    "error",
    {
      checkThenables: true,
      ignoreIIFE: false,
      ignoreVoid: false,
    },
  ],
  "@typescript-eslint/no-for-in-array": "error",
  "@typescript-eslint/no-implied-eval": "error",
  "@typescript-eslint/no-import-type-side-effects": "error",
  "@typescript-eslint/no-inferrable-types": [
    "error",
    { ignoreParameters: false, ignoreProperties: false },
  ],
  "@typescript-eslint/no-invalid-this": "error",
  "@typescript-eslint/no-invalid-void-type": [
    "error",
    { allowAsThisParameter: false, allowInGenericTypeArguments: false },
  ],
  "@typescript-eslint/no-loop-func": "error",
  "@typescript-eslint/no-loss-of-precision": "error",
  "@typescript-eslint/no-meaningless-void-operator": "error",
  "@typescript-eslint/no-misused-new": "error",
  "@typescript-eslint/no-misused-promises": [
    "error",
    { checksConditionals: true, checksSpreads: true, checksVoidReturn: true },
  ],
  "@typescript-eslint/no-misused-spread": "error",
  "@typescript-eslint/no-namespace": [
    "error",
    { allowDeclarations: false, allowDefinitionFiles: false },
  ],
  "@typescript-eslint/no-non-null-asserted-nullish-coalescing": "error",
  "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
  "@typescript-eslint/no-redeclare": ["error", { builtinGlobals: true }],
  "@typescript-eslint/no-redundant-type-constituents": "error",
  "@typescript-eslint/no-require-imports": ["error", { allow: [], allowAsImport: false }],
  "@typescript-eslint/no-this-alias": ["error", { allowDestructuring: false, allowedNames: [] }],
  "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
  "@typescript-eslint/no-unnecessary-parameter-property-assignment": "error",
  "@typescript-eslint/no-unnecessary-qualifier": "error",
  "@typescript-eslint/no-unnecessary-template-expression": "error",
  "@typescript-eslint/no-unnecessary-type-arguments": "error",
  "@typescript-eslint/no-unnecessary-type-assertion": [
    "error",
    { checkLiteralConstAssertions: true },
  ],
  "@typescript-eslint/no-unnecessary-type-constraint": "error",
  "@typescript-eslint/no-unnecessary-type-conversion": "error",
  "@typescript-eslint/no-unnecessary-type-parameters": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-declaration-merging": "error",
  "@typescript-eslint/no-unsafe-function-type": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/no-unsafe-unary-minus": "error",
  "@typescript-eslint/no-unused-expressions": [
    "error",
    {
      allowShortCircuit: false,
      allowTaggedTemplates: false,
      allowTernary: false,
      enforceForJSX: true,
    },
  ],
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      args: "all",
      caughtErrors: "all",
      destructuredArrayIgnorePattern: "",
      ignoreRestSiblings: false,
      vars: "all",
    },
  ],
  "@typescript-eslint/no-use-before-define": [
    "error",
    {
      allowNamedExports: true,
      classes: true,
      enums: true,
      functions: false,
      ignoreTypeReferences: true,
      typedefs: false,
      variables: true,
    },
  ],
  "@typescript-eslint/no-useless-constructor": "error",
  "@typescript-eslint/no-useless-empty-export": "error",
  "@typescript-eslint/no-var-requires": "error",
  "@typescript-eslint/no-wrapper-object-types": "error",
  "@typescript-eslint/only-throw-error": [
    "error",
    { allowRethrowing: true, allowThrowingAny: false, allowThrowingUnknown: false },
  ],
  "@typescript-eslint/parameter-properties": ["error", { allow: [], prefer: "class-property" }],
  "@typescript-eslint/prefer-as-const": "error",
  "@typescript-eslint/prefer-for-of": "error",
  "@typescript-eslint/prefer-function-type": "error",
  "@typescript-eslint/prefer-literal-enum-member": ["error", { allowBitwiseExpressions: false }],
  "@typescript-eslint/prefer-nullish-coalescing": [
    "error",
    {
      ignoreConditionalTests: false,
      ignoreMixedLogicalExpressions: false,
      ignoreTernaryTests: false,
    },
  ],
  "@typescript-eslint/prefer-optional-chain": [
    "error",
    {
      allowPotentiallyUnsafeFixesThatModifyTheReturnTypeIKnowWhatImDoing: false,
      checkAny: true,
      checkBigInt: true,
      checkBoolean: true,
      checkNumber: true,
      checkString: true,
      requireNullish: true,
    },
  ],
  "@typescript-eslint/prefer-promise-reject-errors": "error",
  "@typescript-eslint/prefer-readonly": ["error", { onlyInlineLambdas: false }],
  "@typescript-eslint/prefer-reduce-type-parameter": "error",
  "@typescript-eslint/prefer-regexp-exec": "error",
  "@typescript-eslint/prefer-return-this-type": "error",
  "@typescript-eslint/prefer-string-starts-ends-with": "error",
  "@typescript-eslint/related-getter-setter-pairs": "error",
  "@typescript-eslint/require-array-sort-compare": ["error", { ignoreStringArrays: false }],
  "@typescript-eslint/require-await": "error",
  "@typescript-eslint/restrict-plus-operands": [
    "error",
    {
      allowAny: false,
      allowBoolean: false,
      allowNullish: false,
      allowNumberAndString: false,
      allowRegExp: false,
      skipCompoundAssignments: false,
    },
  ],
  "@typescript-eslint/return-await": ["error", "always"],
  "@typescript-eslint/switch-exhaustiveness-check": [
    "error",
    {
      allowDefaultCaseForExhaustiveSwitch: true,
      considerDefaultExhaustiveForUnions: false,
      requireDefaultForNonUnion: false,
    },
  ],
  "@typescript-eslint/triple-slash-reference": [
    "error",
    { lib: "never", path: "never", types: "never" },
  ],
  "@typescript-eslint/unbound-method": ["error", { ignoreStatic: false }],
  "@typescript-eslint/unified-signatures": [
    "error",
    { ignoreDifferentlyNamedParameters: false, ignoreOverloadsWithDifferentJSDoc: false },
  ],
  "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
};
