/**
 * @file Registry for custom Google TypeScript semantic rules that maintained
 * ESLint plugins do not cover exactly.
 */

import { requireAssertionRationale } from "./assertions.js";
import { noPrivateIdentifiers, noRedundantPublic, noStaticThis } from "./classes.js";
import { componentFunctionNaming } from "./component-function-naming.js";
import { noDefinePropertyAccessors } from "./descriptor-accessors.js";
import { noEnumBooleanCoercion } from "./enum-coercion.js";
import { noUnsafeParameterDefaults } from "./expressions.js";
import {
  noPrototypeManipulation,
  noUnsafeNumericCoercion,
} from "./mutation.js";
import { noNullishTypeAliases, preferOptionalOverUndefinedUnion } from "./type-shape.js";

/**
 * Custom Google-style rules that fill semantic gaps in the maintained plugin
 * ecosystem.
 */
export const googleStyleRules = {
  "component-function-naming": componentFunctionNaming,
  "no-define-property-accessors": noDefinePropertyAccessors,
  "no-enum-boolean-coercion": noEnumBooleanCoercion,
  "no-nullish-type-aliases": noNullishTypeAliases,
  "no-private-identifiers": noPrivateIdentifiers,
  "no-prototype-manipulation": noPrototypeManipulation,
  "no-redundant-public": noRedundantPublic,
  "no-static-this": noStaticThis,
  "no-unsafe-numeric-coercion": noUnsafeNumericCoercion,
  "no-unsafe-parameter-defaults": noUnsafeParameterDefaults,
  "prefer-optional-over-undefined-union": preferOptionalOverUndefinedUnion,
  "require-assertion-rationale": requireAssertionRationale,
} as const;

/**
 * Recommended severities for custom Google-style rules. Google clauses and
 * stricter Agent Code Guard doctrine are both blocking.
 */
export const googleStyleRuleEntries = {
  "agent-code-guard/component-function-naming": "error",
  "agent-code-guard/no-define-property-accessors": "error",
  "agent-code-guard/no-enum-boolean-coercion": "error",
  "agent-code-guard/no-nullish-type-aliases": "error",
  "agent-code-guard/no-private-identifiers": "error",
  "agent-code-guard/no-prototype-manipulation": "error",
  "agent-code-guard/no-redundant-public": "error",
  "agent-code-guard/no-static-this": "error",
  "agent-code-guard/no-unsafe-numeric-coercion": "error",
  "agent-code-guard/no-unsafe-parameter-defaults": "error",
  "agent-code-guard/prefer-optional-over-undefined-union": "error",
  "agent-code-guard/require-assertion-rationale": "error",
} as const;
