/**
 * @file Provides generators and lint helpers shared by rule-correctness property tests.
 */

import * as tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import * as fc from "fast-check";
import * as ts from "typescript";
import { plugin } from "../../index.js";

/** Rule identifiers enabled by the public recommended preset. */
export const RECOMMENDED_RULE_IDS = Object.keys(plugin.configs.recommended.rules);
const parser: Linter.Parser = tsParser;
/** Shared in-memory ESLint instance for rule-correctness properties. */
export const linter = new Linter();
const FIXTURE_OVERVIEW = "/**\n * @file Generated source under rule-correctness property runs.\n */\n\n";

const CUSTOM_RECOMMENDED_RULES = Object.fromEntries(
  Object.entries(plugin.configs.recommended.rules).filter(([ruleId]) =>
    ruleId.startsWith("agent-code-guard/"),
  ),
);

const RESERVED = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "of",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "as",
  "then",
  "query",
  "mock",
  "spyOn",
  "hoisted",
]);

/** Generates compact non-reserved JavaScript identifiers. */
export const identArb = fc
  .stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
  .filter((name) => !RESERVED.has(name));

/** Generates quoted strings that cannot accidentally form rule anti-patterns. */
export const safeStringArb = fc.stringMatching(/^[a-z]{0,12}$/).map((text) => `"${text}"`);
/** Generates alternate identifiers for rename-invariance properties. */
export const renameArb = fc
  .stringMatching(/^[a-z][a-zA-Z0-9]{0,6}$/)
  .filter((name) => !RESERVED.has(name));
/** Generates insignificant whitespace around mutated source snippets. */
export const paddingArb = fc.constantFrom("", " ", "\n", "  ", "\n\n", "\t");

const safeNumberArb = fc.integer({ min: 0, max: 1000 }).map((value) => String(value));
const safeBoolArb = fc.constantFrom("true", "false");
const safeLiteralArb = fc.oneof(safeStringArb, safeNumberArb, safeBoolArb);
const literalDeclArb = fc
  .tuple(identArb, safeLiteralArb)
  .map(([id, literal]) => `const ${id} = ${literal};`);

const typedDeclArb = fc
  .tuple(identArb, fc.constantFrom("number", "string", "boolean"))
  .chain(([id, typeName]) =>
    literalArbForType(typeName).map((literal) => `const ${id}: ${typeName} = ${literal};`),
  );

const plainFnArb = fc
  .tuple(identArb, identArb, safeNumberArb)
  .map(
    ([functionName, parameterName, value]) =>
      `function ${functionName}(${parameterName}: number): number { return ${parameterName} + ${value}; }`,
  );

/** Generates small TypeScript programs with no known guarded anti-pattern. */
export const safeSourceArb = fc
  .array(fc.oneof(literalDeclArb, typedDeclArb, plainFnArb), { minLength: 1, maxLength: 5 })
  .map((statements) => statements.join("\n"));

/**
 * Builds a typed flat config around an arbitrary rule map.
 * @param rules The rules to enable in the fixture configuration.
 * @returns A typed flat configuration for in-memory linting.
 */
export function baseConfig(rules: Linter.RulesRecord): Linter.Config {
  return {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2022,
        projectService: {
          allowDefaultProject: [
            "jest.config.js",
            "src/auth.test.ts",
            "src/foo.test.ts",
            "src/handlers/test.ts",
            "src/lint-target.ts",
            "test.ts",
          ],
        },
        sourceType: "module",
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: plugin.configs.recommended.plugins,
    rules,
    settings: plugin.configs.recommended.settings,
  };
}

/**
 * Runs every recommended diagnostic against one source string.
 *
 * Generated sources are fragments rather than files, so a canonical overview
 * is prepended to keep the file-shell contract from firing on every one.
 * @param code The source text to lint.
 * @param filename The project-relative fixture filename.
 * @returns The emitted lint diagnostics.
 */
export function lintAll(
  code: string,
  filename = "src/lint-target.ts",
): Linter.LintMessage[] {
  return linter.verify(`${FIXTURE_OVERVIEW}${code}`, baseConfig(CUSTOM_RECOMMENDED_RULES), {
    filename,
  });
}

/**
 * Runs one named rule against one source string.
 * @param code The source text to lint.
 * @param ruleId The fully qualified rule identifier.
 * @param filename The project-relative fixture filename.
 * @returns The emitted lint diagnostics.
 */
export function lintOne(
  code: string,
  ruleId: string,
  filename = "src/lint-target.ts",
): Linter.LintMessage[] {
  return linter.verify(code, baseConfig({ [ruleId]: "error" }), { filename });
}

/**
 * Returns whether TypeScript can parse and transpile the supplied source.
 * @param code The source text to parse.
 * @returns Whether TypeScript reports no syntax errors.
 */
export function isSyntacticallyValid(code: string): boolean {
  const result = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.Latest },
    reportDiagnostics: true,
  });
  return (
    result.diagnostics?.every(
      (diagnostic) => diagnostic.category !== ts.DiagnosticCategory.Error,
    ) ?? true
  );
}

/**
 * Mutates a rule seed by padding and consistently renaming one identifier.
 * @param seed The original source seed.
 * @param pad Whitespace to add around the seed.
 * @param ident The identifier to replace.
 * @param rename The replacement identifier.
 * @returns The transformed source seed.
 */
export function mutate(seed: string, pad: string, ident: string, rename: string): string {
  const renamed =
    ident.length > 0 ? seed.replace(new RegExp(`\\b${escapeRegex(ident)}\\b`, "g"), rename) : seed;
  return `${pad}${renamed}${pad}`;
}

/**
 * Formats lint diagnostics for property-test failure output.
 * @param messages The lint diagnostics to format.
 * @returns A multiline diagnostic summary.
 */
export function messageDetails(messages: readonly Linter.LintMessage[]): string {
  return messages.map((message) => `  [${message.ruleId ?? "?"}] ${message.message}`).join("\n");
}

/** Custom rule identifiers that publish an ESLint autofixer. */
export const FIXABLE_RULE_IDS = Object.entries(plugin.rules)
  .filter(([, rule]) => rule.meta.fixable)
  .map(([name]) => `agent-code-guard/${name}`);

function literalArbForType(typeName: string): fc.Arbitrary<string> {
  if (typeName === "number") {
    return safeNumberArb;
  }
  if (typeName === "string") {
    return safeStringArb;
  }
  return safeBoolArb;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const IDENTS_BY_SEED: Record<string, string> = {
  "agent-code-guard/async-keyword": "foo",
  "agent-code-guard/as-unknown-as": "raw",
  "agent-code-guard/promise-type": "foo",
  "agent-code-guard/then-chain": "",
  "agent-code-guard/bare-catch": "doThing",
  "agent-code-guard/effect-promise": "run",
  "agent-code-guard/effect-error-erasure": "",
  "agent-code-guard/either-discriminant": "result",
  "agent-code-guard/manual-tagged-error": "RunError",
  "agent-code-guard/no-conditional-chaining": "fetchUser",
  "agent-code-guard/no-console-in-effect": "Effect",
  "agent-code-guard/no-promise-all-in-effect": "tasks",
  "agent-code-guard/prefer-effect-platform": "Effect",
  "agent-code-guard/no-schema-type-cast": "value",
  "agent-code-guard/fork-requires-lifecycle": "work",
  "agent-code-guard/prefer-decode-effect-at-boundary": "input",
  "agent-code-guard/require-span-on-exported-effect": "program",
  "agent-code-guard/handler-requires-span": "handle",
  "agent-code-guard/logger-config-at-boot": "wrap",
  "agent-code-guard/prefer-annotate-logs": "",
  "agent-code-guard/annotate-without-span": "",
  "agent-code-guard/prefer-config-redacted": "apiKey",
  "agent-code-guard/effect-foreach-requires-concurrency": "items",
  "agent-code-guard/acquire-release-requires-scope": "open",
  "agent-code-guard/finalizer-requires-scope": "close",
  "agent-code-guard/parse-into-schema-requires-effect": "input",
  "agent-code-guard/no-effect-error-coalescing": "program",
  "agent-code-guard/no-exported-brand-constructor": "UserId",
  "agent-code-guard/no-unbounded-concurrency": "tasks",
  "agent-code-guard/no-process-env-at-runtime": "port",
  "agent-code-guard/no-env-nonnull-assert": "port",
  "agent-code-guard/manual-result": "input",
  "agent-code-guard/manual-option": "apply",
  "agent-code-guard/manual-brand": "UserId",
  "agent-code-guard/no-manual-brand-constructor": "value",
  "agent-code-guard/record-cast": "r",
  "agent-code-guard/no-raw-sql": "db",
  "agent-code-guard/no-manual-enum-cast": "s",
  "agent-code-guard/no-raw-throw-new-error": "",
  "agent-code-guard/no-test-skip-only": "",
  "agent-code-guard/no-example-only-tests": "",
  "agent-code-guard/no-coverage-threshold-gate": "",
  "agent-code-guard/no-hardcoded-assertion-literals": "result",
};

/**
 * Returns the identifier that mutation properties may safely rename.
 * @param ruleId The fully qualified rule identifier.
 * @returns The identifier selected for rename mutation.
 */
export function seedIdent(ruleId: string): string {
  return IDENTS_BY_SEED[ruleId] ?? "";
}
