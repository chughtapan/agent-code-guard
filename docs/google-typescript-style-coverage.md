# Google TypeScript Style coverage

This ledger maps the normative clauses in the
[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
to the enforcement shipped by Agent Code Guard. Google Style is the minimum:
where Agent Code Guard is stricter, the stricter rule wins.

The guide uses RFC 2119 language and states that imperative text is
prescriptive, while optional formatting choices in examples must not become
rules. This package therefore makes every enabled code rule blocking, but
deliberately ships no formatter rules or formatter gate.

## Status legend

| Status | Meaning |
|---|---|
| **Rule** | Enforced as an ESLint error in both `recommended` and `strict`. |
| **Compiler** | Enforced when the consuming repository runs TypeScript with the corresponding compiler option. |
| **Rule + compiler** | Both lint and the compiler participate. |
| **Review-only** | The clause requires project, framework, API, or human semantic context that an ESLint file rule cannot determine reliably. |
| **Formatting excluded** | Deliberately left to an external formatter such as Oxfmt; it is not a lint or CI formatting gate. |
| **Not normative** | The guide explicitly leaves the choice local or says it may be used. |

## Source files and modules

| Google clause family | Status | Enforcement or limitation |
|---|---|---|
| UTF-8 source, horizontal spaces, escapes, non-ASCII readability | **Formatting excluded / review-only** | Encoding and character presentation belong to source tooling and review. No formatter gate is bundled. |
| Source section order, blank lines, copyright, optional `@fileoverview` | **Formatting excluded / not normative** | Section spacing is formatting. Copyright is repository-specific and `@fileoverview` is optional. |
| TypeScript import paths | **Rule + review-only** | `import-x/no-absolute-path`, `no-commonjs`, `no-dynamic-require`, `@typescript-eslint/no-require-imports`, and `triple-slash-reference`. Whether a bare alias names an intra-project module is resolver/project-specific and remains review-only. |
| Prefer relative imports within one logical project; limit `../` depth | **Review-only** | Logical project boundaries and acceptable parent depth are repository architecture, not reliably inferable from one portable preset. |
| Namespace versus named imports and import renaming | **Review-only** | The guide makes this depend on frequency, API size, collisions, generated names, and clarity. |
| Type-only imports and exports | **Rule + compiler** | `@typescript-eslint/consistent-type-imports`, `consistent-type-exports`, `no-import-type-side-effects`, `isolatedModules`. |
| Named exports; no default exports | **Rule** | `import-x/no-default-export`, `no-named-default`, and named package API surfaces. |
| Minimize export visibility | **Review-only** | Only the owning project knows which symbols are consumed outside a module. Knip catches unused exports where its project graph can prove them. |
| No mutable exports | **Rule** | `import-x/no-mutable-exports`. |
| No container classes used as namespaces | **Rule** | `@typescript-eslint/no-extraneous-class` disallows static-only containers; modules and named exports are required instead. |
| ES modules, not namespaces, `require`, or triple-slash references | **Rule** | `@typescript-eslint/no-namespace`, `no-require-imports`, `no-var-requires`, `triple-slash-reference`, and `import-x/no-commonjs`. |

## Language features

| Google clause family | Status | Enforcement or limitation |
|---|---|---|
| `const`/`let`, prefer `const`, never `var`, declaration before use | **Rule** | `no-var`, `prefer-const`, `block-scoped-var`, and `@typescript-eslint/no-use-before-define`. |
| One variable per declaration | **Rule** | `one-var: ["error", "never"]`. |
| No `Array` or `Object` constructors | **Rule** | ESLint and TypeScript-ESLint `no-array-constructor`, plus `no-object-constructor`. |
| Array non-index properties | **Compiler / review-only** | Typed arrays reject undeclared named properties. Dynamic or deliberately widened array values require review. |
| Spread only values compatible with the target container | **Rule + compiler** | `@typescript-eslint/no-misused-spread` plus TypeScript assignability. |
| Optional array/object destructuring defaults are `[]`/`{}`; defaults live on the left | **Rule** | `agent-code-guard/no-unsafe-parameter-defaults`. |
| Object parameter destructuring is one level and non-computed | **Rule** | `agent-code-guard/no-unsafe-parameter-defaults`. |
| Prefer object over array destructuring where names improve clarity | **Review-only** | This is explicitly contextual. |
| Computed and dict-style object keys are not mixed | **Review-only** | The correct classification depends on whether keys model an external dictionary or a record-like API. |
| Class declaration/method semicolons and blank-line placement | **Formatting excluded** | Semicolons and vertical spacing are formatter policy. |
| `toString` always succeeds and has no visible side effects | **Review-only** | Whole-call-graph purity and “visible” effects cannot be established soundly by a portable local ESLint rule. |
| Avoid private static helpers and static dynamic dispatch | **Rule + review-only** | `agent-code-guard/no-static-this` exactly bans static `this`; subclass/constructor-variable dispatch and readability-based private-static advice remain review-only. |
| Constructor calls use parentheses; omit useless constructors | **Rule** | `new-parens` and `@typescript-eslint/no-useless-constructor`. |
| No `#private`; use TypeScript visibility | **Rule** | `agent-code-guard/no-private-identifiers`. |
| Use `readonly` for stable members | **Rule** | `@typescript-eslint/prefer-readonly`. |
| Parameter properties and field initialization | **ACG stricter rule** | `@typescript-eslint/parameter-properties` forbids parameter properties altogether, and `no-unnecessary-parameter-property-assignment` rejects redundant plumbing. Agent Code Guard chooses explicit fields over Google’s parameter-property preference. Constructor-only initialization versus declaration initialization remains contextual. |
| Omit redundant `public` | **Rule** | `agent-code-guard/no-redundant-public`. |
| Visibility for framework-reflected/template properties | **Review-only** | Framework templates and reflection are outside the TypeScript AST usage graph. |
| Getters/setters, no descriptor accessors, paired types | **Rule + review-only** | `accessor-pairs`, `@typescript-eslint/related-getter-setter-pairs`, and `agent-code-guard/no-define-property-accessors`. Getter purity and appropriate accessor visibility remain review-only. |
| Prefer function declarations for named functions; no ordinary function expressions | **Rule + review-only** | `prefer-arrow-callback`, `no-invalid-this`, and `no-this-alias` cover callbacks and rebinding hazards. The guide’s exceptions for generators, explicit function types, nesting, and readability make the declaration-versus-arrow choice contextual. |
| Do not leak callback return values in void contexts | **Rule** | `@typescript-eslint/no-confusing-void-expression` and typed promise misuse rules. |
| Explicit callback forwarding where signatures may drift | **Review-only** | Stability of both call signatures is API-specific. |
| String and number literal spelling | **Formatting excluded** | Quote selection, numeric literal casing, and equivalent literal spelling are formatter/style presentation. |
| Enum values are never coerced to boolean | **Rule** | Type-aware `agent-code-guard/no-enum-boolean-coercion` covers `Boolean`, `!`/`!!`, logical tests, conditional expressions, and loop/branch conditions. |
| Numeric parsing avoids unary `+`, `parseFloat`, and base-10 `parseInt` | **Rule** | `agent-code-guard/no-unsafe-numeric-coercion`; only an explicit literal non-decimal radix is accepted. |
| Validate `Number()` results and radix input | **Review-only** | Proving that validation dominates every use, or that failure is impossible from context, requires path- and domain-sensitive analysis. |
| Braced control flow, no ambiguous assignments | **Rule** | `curly: ["error", "all"]` is intentionally stricter than the guide’s one-line exception; `no-cond-assign` rejects ambiguous assignments. |
| `for...of`/object iteration safety | **Rule** | `guard-for-in`, `prefer-for-of`, `no-for-in-array`, and `prefer-object-has-own`. |
| Switch default last, no fallthrough, exhaustive typed unions | **Rule + compiler** | `default-case`, `default-case-last`, `no-fallthrough`, `noFallthroughCasesInSwitch`, and `@typescript-eslint/switch-exhaustiveness-check`. |
| Strict equality, except nullish `== null` | **Rule** | `eqeqeq` with the guide’s literal-null exception. |
| Assertions need a reason and use `as` syntax | **Rule** | `agent-code-guard/require-assertion-rationale` is stricter than the guide by requiring a durable local rationale; `consistent-type-assertions` bans angle-bracket syntax and object/array literal assertions. Existing ACG cast rules remain stricter. |
| Keep `try` blocks focused | **Review-only** | The guide explicitly conditions this on readability and performance. |
| Empty catch blocks explain themselves | **Rule** | Existing `agent-code-guard/bare-catch`, core `no-empty`, and directive-description rules. |
| Do not define decorators | **ACG stricter rule** | `no-restricted-syntax` rejects every decorator instead of maintaining a framework allowlist. |
| No wrapper constructors/types | **Rule** | `no-new-wrappers`, `@typescript-eslint/no-wrapper-object-types`. |
| No `const enum`, debugger, `with`, dynamic evaluation | **Rule** | `no-restricted-syntax`, `no-debugger`, `no-with`, `no-eval`, `no-implied-eval`, and `no-new-func`. |
| No non-standard or runtime-incompatible platform features | **Compiler / review-only** | The project’s TypeScript `target`/`lib` and deprecation checks cover declared availability. Runtime support and proprietary APIs remain deployment-specific. |
| Do not modify builtins, prototypes, or globals | **Rule + review-only** | `no-extend-native`, `no-proto`, and `agent-code-guard/no-prototype-manipulation`. Dependencies that mutate globals at load time require supply-chain review. |

## Naming and types

| Google clause family | Status | Enforcement or limitation |
|---|---|---|
| Identifier casing, no leading/trailing `_`, no `_` placeholder | **Rule** | `@typescript-eslint/naming-convention` enforces lower camel variables/parameters/members, upper camel types/type parameters, and constant-case enum members. `agent-code-guard/component-function-naming` preserves the guide’s UpperCamelCase exception for TSX component functions while rejecting type-like names on ordinary functions. Quoted/object-literal keys remain available for external APIs; Effect’s conventional `_tag` discriminator is the explicit interoperability exception. |
| Descriptive names, familiar abbreviations, no type decoration | **Review-only** | Meaning, reader familiarity, scope length, and framework idioms are human semantic judgments. |
| `$` naming exceptions and structured test names | **Review-only** | These depend on Observable and test-framework conventions. |
| Leave trivially inferred annotations out | **Rule** | `@typescript-eslint/no-inferrable-types`. |
| Return annotations where useful | **Not normative** | The guide leaves this to authors, reviewers, and local project policy. |
| Nullable aliases are forbidden | **Rule** | `agent-code-guard/no-nullish-type-aliases`. |
| Prefer optional fields/parameters over `| undefined` | **Rule** | `agent-code-guard/prefer-optional-over-undefined-union`. |
| Structural implementations are explicitly typed | **Review-only / compiler** | TypeScript validates annotations when present; deciding which object literal implements a durable conceptual interface requires design context. |
| Interfaces for object shapes | **Rule** | `@typescript-eslint/consistent-type-definitions: interface`. |
| Array type spelling | **Rule** | `@typescript-eslint/array-type: array-simple`. |
| Meaningful index-signature names; prefer `Map` when appropriate | **Review-only** | “Meaningful” and associative-object versus `Map` intent are domain judgments. |
| Avoid over-complex mapped/conditional types | **Review-only** | The guide explicitly asks reviewers to judge understandability. |
| Avoid `any`; prefer `unknown`; document suppressions | **Rule** | `no-explicit-any`, the full typed `no-unsafe-*` family, `use-unknown-in-catch-callback-variable`, and scoped suppression descriptions. Agent Code Guard is stricter than the guide’s warning-level posture. |
| Avoid `{}` and empty object interfaces | **Rule** | `@typescript-eslint/no-empty-object-type`. |
| Tuple versus named object choice | **Review-only** | The guide presents both and makes clarity contextual. |
| Avoid return-type-only generics | **Rule** | `@typescript-eslint/no-unnecessary-type-parameters` and `prefer-reduce-type-parameter`. |

## Toolchain, comments, and documentation

| Google clause family | Status | Enforcement or limitation |
|---|---|---|
| Every TypeScript file passes standard type checking | **Repository configuration** | The consuming repository must run `tsc` in its own quality pipeline. A portable ESLint preset cannot reliably infer that contract from package-script text or constrain the repository's task orchestrator. |
| No `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck` | **Rule** | `@typescript-eslint/ban-ts-comment` rejects all variants. This is stricter than the guide’s discouraged unit-test exception. |
| Applicable global/framework conformance rules | **Review-only** | A portable package cannot discover private framework conformance systems; repository-local rules can extend the preset. |
| JSDoc for every top-level export | **Rule** | Both main presets include export-scoped `jsdoc/require-jsdoc`; the standalone `documentation` preset remains available for composition. |
| JSDoc descriptions, parameters, properties, and returns | **ACG stricter rule** | The bundled requirements/content rules require complete descriptions on exported APIs even where Google allows omission when obvious. |
| No redundant JSDoc type annotations | **Rule** | `jsdoc/no-types`, with parameter/return type requirements disabled. |
| Informative comments and approved JSDoc structure/tags | **Rule + review-only** | JSDoc logical/content rules catch invalid and uninformative documentation. Whether prose adds enough domain information remains review-only. |
| Ordinary multiline comment presentation, Markdown wrapping, tag alignment | **Formatting excluded** | These are presentation and wrapping concerns, so no lint or formatter gate is included. |
| Parameter-name comments at ambiguous call sites | **Review-only** | Ambiguity depends on API semantics and reader context. |
| Documentation before decorators | **Not applicable** | Decorators are rejected entirely by the stricter preset. |
| Deprecations include migration directions | **Rule + review-only** | JSDoc tag validity is linted; whether directions are sufficient requires review. |
| Generated code exemptions | **Repository configuration** | Generated paths can be ignored or overridden by the consuming repository; hand-written exported identifiers remain subject to the preset. |

## Deliberate boundaries

The remaining review-only items are not silent gaps. They are cases where a
portable ESLint rule would guess about logical project boundaries, runtime
support, API intent, framework reflection, whole-program purity, or prose
quality. The preset does not pretend that a syntactic heuristic proves those
facts. Repositories may layer architecture- or framework-specific rules on
top; every enabled rule still remains an error.
