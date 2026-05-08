import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import * as fc from "fast-check";
import sonarjs from "eslint-plugin-sonarjs";
import * as ts from "typescript";
import plugin from "../../index.js";

export interface RuleSeed {
  readonly ruleId: string;
  readonly seed: string;
  readonly coFire: readonly string[];
  readonly filename?: string;
}

export const RECOMMENDED_RULE_IDS = Object.keys(plugin.configs.recommended.rules);
const parser: Linter.Parser = tsParser;
const pluginEntry: NonNullable<Linter.Config["plugins"]>[string] = plugin;
export const linter = new Linter();

const RESERVED = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
  "false", "finally", "for", "function", "if", "import", "in", "instanceof",
  "let", "new", "null", "of", "return", "super", "switch", "this", "throw",
  "true", "try", "typeof", "var", "void", "while", "with", "yield", "as",
  "then", "query", "mock", "spyOn", "hoisted",
]);

export const identArb = fc
  .stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
  .filter((name) => !RESERVED.has(name));

export const safeStringArb = fc.stringMatching(/^[a-z]{0,12}$/).map((text) => `"${text}"`);
export const renameArb = fc
  .stringMatching(/^[a-z][a-zA-Z0-9]{0,6}$/)
  .filter((name) => !RESERVED.has(name));
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
    literalArbForType(typeName).map((literal) => `const ${id}: ${typeName} = ${literal};`)
  );

const plainFnArb = fc
  .tuple(identArb, identArb, safeNumberArb)
  .map(([functionName, parameterName, value]) =>
    `function ${functionName}(${parameterName}: number): number { return ${parameterName} + ${value}; }`,
  );

export const safeSourceArb = fc
  .array(fc.oneof(literalDeclArb, typedDeclArb, plainFnArb), { minLength: 1, maxLength: 5 })
  .map((statements) => statements.join("\n"));

const sonarjsEntry = sonarjs as NonNullable<Linter.Config["plugins"]>[string];

export function baseConfig(rules: Linter.RulesRecord): Linter.Config {
  return {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": pluginEntry, sonarjs: sonarjsEntry },
    rules,
  };
}

export function lintAll(code: string, filename: string = "test.ts"): Linter.LintMessage[] {
  return linter.verify(code, baseConfig(plugin.configs.recommended.rules), { filename });
}

export function lintOne(
  code: string,
  ruleId: string,
  filename: string = "test.ts",
): Linter.LintMessage[] {
  return linter.verify(code, baseConfig({ [ruleId]: "error" }), { filename });
}

export function isSyntacticallyValid(code: string): boolean {
  const sourceFile = ts.createSourceFile(
    "test.ts",
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  return sourceFile.parseDiagnostics.length === 0;
}

export function mutate(seed: string, pad: string, ident: string, rename: string): string {
  const renamed = ident.length > 0
    ? seed.replace(new RegExp(`\\b${escapeRegex(ident)}\\b`, "g"), rename)
    : seed;
  return `${pad}${renamed}${pad}`;
}

export function seedIdent(ruleId: string): string {
  return IDENTS_BY_SEED[ruleId] ?? "";
}

export function messageDetails(messages: readonly Linter.LintMessage[]): string {
  return messages
    .map((message) => `  [${message.ruleId ?? "?"}] ${message.message}`)
    .join("\n");
}

export const SEEDS: readonly RuleSeed[] = [
  { ruleId: "agent-code-guard/async-keyword", seed: "async function foo() {}", coFire: [] },
  { ruleId: "agent-code-guard/as-unknown-as", seed: "const row = raw as unknown as UserRow;", coFire: [] },
  { ruleId: "agent-code-guard/promise-type", seed: "function foo(): Promise<number> { return Promise.resolve(1); }", coFire: [] },
  { ruleId: "agent-code-guard/then-chain", seed: "Promise.resolve(1).then((v) => v);", coFire: [] },
  { ruleId: "agent-code-guard/bare-catch", seed: "try { doThing(); } catch {}", coFire: [] },
  { ruleId: "agent-code-guard/effect-promise", seed: "const run = () => Effect.promise(() => fetch('/x'));", coFire: [] },
  { ruleId: "agent-code-guard/effect-error-erasure", seed: "const fail = () => Effect.fail(new Error('boom'));", coFire: [] },
  { ruleId: "agent-code-guard/either-discriminant", seed: "if (Either.isLeft(result)) return result.left;", coFire: [] },
  { ruleId: "agent-code-guard/manual-tagged-error", seed: "class RunError extends Error { readonly _tag = 'RunError' as const; }", coFire: ["sonarjs/class-name"] },
  { ruleId: "agent-code-guard/no-conditional-chaining", seed: "function loadUser(id?: string) { return fetchUser(id); }", coFire: [] },
  { ruleId: "agent-code-guard/no-console-in-effect", seed: 'import { Effect } from "effect";\nconst program = Effect.succeed(1);\nconsole.log(program);', coFire: [] },
  { ruleId: "agent-code-guard/no-promise-all-in-effect", seed: 'import { Effect } from "effect";\nconst tasks = [Effect.succeed(1)];\nexport const run = () => Promise.all(tasks);', coFire: [] },
  { ruleId: "agent-code-guard/prefer-effect-platform", seed: 'import { Effect } from "effect";\nexport const x = Effect.succeed(1);\nexport const args = process.argv.slice(2);', coFire: [] },
  { ruleId: "agent-code-guard/no-schema-type-cast", seed: "const u = value as Schema.Schema.Type<typeof UserSchema>;", coFire: [] },
  { ruleId: "agent-code-guard/fork-requires-lifecycle", seed: "function* run() { yield* Effect.fork(work); }", coFire: [] },
  { ruleId: "agent-code-guard/prefer-decode-effect-at-boundary", seed: "const u = Schema.decodeUnknownSync(S)(JSON.parse(input));", coFire: [] },
  { ruleId: "agent-code-guard/require-span-on-exported-effect", seed: "export const program = Effect.gen(function* () { return yield* load; });", coFire: [] },
  { ruleId: "agent-code-guard/handler-requires-span", seed: "export const handle = Effect.gen(function* () { return yield* load; });", filename: "src/handlers/test.ts", coFire: ["agent-code-guard/require-span-on-exported-effect"] },
  { ruleId: "agent-code-guard/logger-config-at-boot", seed: "export const wrap = (p) => Logger.withMinimumLogLevel(level)(p);", coFire: [] },
  { ruleId: "agent-code-guard/no-effect-error-coalescing", seed: "const run = program.pipe(Effect.mapError(() => new LoadError()));", coFire: [] },
  { ruleId: "agent-code-guard/no-exported-brand-constructor", seed: "export const UserId = Brand.nominal<UserId>();", coFire: [] },
  { ruleId: "agent-code-guard/no-unbounded-concurrency", seed: "yield* Effect.all(tasks, { concurrency: 'unbounded' });", coFire: [] },
  { ruleId: "agent-code-guard/no-process-env-at-runtime", seed: "const port = process.env.PORT;", coFire: [] },
  { ruleId: "agent-code-guard/no-env-nonnull-assert", seed: "const port = process.env.PORT!;", coFire: ["agent-code-guard/no-process-env-at-runtime"] },
  {
    ruleId: "agent-code-guard/manual-result",
    seed: "const Result = { ok: (value: number) => ({ ok: true as const, value }), err: (error: Error) => ({ ok: false as const, error }), match: (input: unknown) => input };",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/manual-option",
    seed: "const Option = { some: (value: number) => ({ _tag: 'Some' as const, value }), none: { _tag: 'None' as const }, flatMap: (apply: (value: number) => unknown) => apply(1) };",
    coFire: [],
  },
  { ruleId: "agent-code-guard/manual-brand", seed: "type UserId = string & { readonly __brand: 'UserId' };", coFire: [] },
  { ruleId: "agent-code-guard/no-manual-brand-constructor", seed: "const asUserId = (value: string): UserId => value as UserId;", coFire: [] },
  { ruleId: "agent-code-guard/record-cast", seed: "const r = {} as Record<string, unknown>;", coFire: [] },
  { ruleId: "agent-code-guard/no-raw-sql", seed: "db.query('SELECT * FROM users');", coFire: [] },
  { ruleId: "agent-code-guard/no-manual-enum-cast", seed: "const s = x as 'active' | 'inactive';", coFire: [] },
  { ruleId: "agent-code-guard/no-raw-throw-new-error", seed: "throw new Error('boom');", coFire: [] },
  { ruleId: "agent-code-guard/no-test-skip-only", seed: "it.skip('wip', () => {});", coFire: [], filename: "src/auth.test.ts" },
  {
    ruleId: "agent-code-guard/no-example-only-tests",
    seed: "it('a', () => {}); it('b', () => {}); it('c', () => {}); it('d', () => {});",
    coFire: [],
    filename: "src/auth.test.ts",
  },
  {
    ruleId: "agent-code-guard/no-coverage-threshold-gate",
    seed: "module.exports = { coverageThreshold: { global: { lines: 80 } } };",
    coFire: [],
    filename: "jest.config.js",
  },
  { ruleId: "agent-code-guard/no-hardcoded-assertion-literals", seed: 'expect(result).toBe("processed");', coFire: ["sonarjs/no-empty-test-file"], filename: "src/foo.test.ts" },
  { ruleId: "agent-code-guard/tag-discriminant", seed: "if (err._tag === 'WebhookTimeoutError') return;", coFire: [] },
];

export const FIXABLE_RULE_IDS = Object.entries(plugin.rules)
  .filter(([, rule]) => rule.meta.fixable)
  .map(([name]) => `agent-code-guard/${name}`);

function literalArbForType(typeName: string): fc.Arbitrary<string> {
  if (typeName === "number") return safeNumberArb;
  if (typeName === "string") return safeStringArb;
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
  "agent-code-guard/tag-discriminant": "",
};
