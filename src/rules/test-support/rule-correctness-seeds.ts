/**
 * @file Canonical source snippets used to verify that every recommended custom
 * rule reports its own representative violation.
 */

/** Describes one rule-specific diagnostic seed and its expected co-fires. */
export interface RuleSeed {
  readonly ruleId: string;
  readonly seed: string;
  readonly coFire: readonly string[];
  readonly filename?: string;
}

/** Representative violating source for every custom recommended rule. */
export const SEEDS: readonly RuleSeed[] = [
  { ruleId: "agent-code-guard/async-keyword", seed: "async function foo() {}", coFire: [] },
  {
    ruleId: "agent-code-guard/as-unknown-as",
    seed: "const row = raw as unknown as UserRow;",
    coFire: ["agent-code-guard/require-assertion-rationale"],
  },
  {
    ruleId: "agent-code-guard/promise-type",
    seed: "function foo(): Promise<number> { return Promise.resolve(1); }",
    coFire: [],
  },
  { ruleId: "agent-code-guard/then-chain", seed: "Promise.resolve(1).then((v) => v);", coFire: [] },
  { ruleId: "agent-code-guard/bare-catch", seed: "try { doThing(); } catch {}", coFire: [] },
  {
    ruleId: "agent-code-guard/effect-promise",
    seed: "const run = () => Effect.promise(() => fetch('/x'));",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/effect-error-erasure",
    seed: "const fail = () => Effect.fail(new Error('boom'));",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/either-discriminant",
    seed: "if (Either.isLeft(result)) return result.left;",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/manual-tagged-error",
    seed: "class RunError extends Error { readonly _tag = 'RunError' as const; }",
    coFire: ["sonarjs/class-name"],
  },
  {
    ruleId: "agent-code-guard/no-conditional-chaining",
    seed: "function loadUser(id?: string) { return fetchUser(id); }",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-console-in-effect",
    seed: 'import { Effect } from "effect";\nconst program = Effect.succeed(1);\nconsole.log(program);',
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-promise-all-in-effect",
    seed: 'import { Effect } from "effect";\nconst tasks = [Effect.succeed(1)];\nexport const run = () => Promise.all(tasks);',
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/prefer-effect-platform",
    seed: 'import { Effect } from "effect";\nexport const x = Effect.succeed(1);\nexport const args = process.argv.slice(2);',
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-schema-type-cast",
    seed: "const u = value as Schema.Schema.Type<typeof UserSchema>;",
    coFire: ["agent-code-guard/require-assertion-rationale"],
  },
  {
    ruleId: "agent-code-guard/fork-requires-lifecycle",
    seed: "function* run() { yield* Effect.fork(work); }",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/prefer-decode-effect-at-boundary",
    seed: "const u = Schema.decodeUnknownSync(S)(JSON.parse(input));",
    coFire: ["agent-code-guard/parse-into-schema-requires-effect"],
  },
  {
    ruleId: "agent-code-guard/require-span-on-exported-effect",
    seed: "export const program = () => Effect.gen(function* () { return yield* load; });",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/handler-requires-span",
    seed: "export const handle = Effect.gen(function* () { return yield* load; });",
    filename: "src/handlers/test.ts",
    coFire: ["agent-code-guard/require-span-on-exported-effect"],
  },
  {
    ruleId: "agent-code-guard/logger-config-at-boot",
    seed: "export const wrap = (p) => Logger.withMinimumLogLevel(level)(p);",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/prefer-annotate-logs",
    seed: 'Effect.log("loaded", { id: 1 });',
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/annotate-without-span",
    seed: "Effect.annotateCurrentSpan({ x: 1 });",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/prefer-config-redacted",
    seed: 'const apiKey = Config.string("API_KEY");',
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/effect-foreach-requires-concurrency",
    seed: "Effect.forEach(items, fn);",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/acquire-release-requires-scope",
    seed: "const program = Effect.acquireRelease(open, close);",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/finalizer-requires-scope",
    seed: "Scope.addFinalizer(close);",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/parse-into-schema-requires-effect",
    seed: "const u = Schema.decodeUnknownSync(S)(JSON.parse(input));",
    coFire: ["agent-code-guard/prefer-decode-effect-at-boundary"],
  },
  {
    ruleId: "agent-code-guard/no-effect-error-coalescing",
    seed: "const run = program.pipe(Effect.mapError(() => new LoadError()));",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-exported-brand-constructor",
    seed: "export const UserId = Brand.nominal<UserId>();",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-unbounded-concurrency",
    seed: "yield* Effect.all(tasks, { concurrency: 'unbounded' });",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-process-env-at-runtime",
    seed: "const port = process.env.PORT;",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-env-nonnull-assert",
    seed: "const port = process.env.PORT!;",
    coFire: [
      "agent-code-guard/no-process-env-at-runtime",
      "agent-code-guard/require-assertion-rationale",
    ],
  },
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
  {
    ruleId: "agent-code-guard/manual-brand",
    seed: "type UserId = string & { readonly __brand: 'UserId' };",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-manual-brand-constructor",
    seed: "const asUserId = (value: string): UserId => value as UserId;",
    coFire: ["agent-code-guard/require-assertion-rationale"],
  },
  {
    ruleId: "agent-code-guard/record-cast",
    seed: "const r = {} as Record<string, unknown>;",
    coFire: ["agent-code-guard/require-assertion-rationale"],
  },
  { ruleId: "agent-code-guard/no-raw-sql", seed: "db.query('SELECT * FROM users');", coFire: [] },
  {
    ruleId: "agent-code-guard/no-manual-enum-cast",
    seed: "const s = x as 'active' | 'inactive';",
    coFire: ["agent-code-guard/require-assertion-rationale"],
  },
  {
    ruleId: "agent-code-guard/no-raw-throw-new-error",
    seed: "throw new Error('boom');",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-test-skip-only",
    seed: "it.skip('wip', () => {});",
    coFire: [],
    filename: "src/auth.test.ts",
  },
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
  {
    ruleId: "agent-code-guard/no-hardcoded-assertion-literals",
    seed: 'expect(result).toBe("processed");',
    coFire: ["sonarjs/no-empty-test-file"],
    filename: "src/foo.test.ts",
  },
  {
    ruleId: "agent-code-guard/no-nullish-type-aliases",
    seed: "type OptionalValue = string | null;",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/prefer-optional-over-undefined-union",
    seed: "interface Input { value: string | undefined; }",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-static-this",
    seed: "class Store { static value = 1; static read(): number { return this.value; } }",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-private-identifiers",
    seed: "class Store { #value = 1; }",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-redundant-public",
    seed: "class Store { public value = 1; }",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-unsafe-parameter-defaults",
    seed: "function read(value = load()): unknown { return value; }",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-unsafe-numeric-coercion",
    seed: "const value = parseFloat(input);",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-prototype-manipulation",
    seed: "Object.setPrototypeOf(target, parent);",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-define-property-accessors",
    seed: "Object.defineProperty(target, 'value', { get() { return 1; } });",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/require-assertion-rationale",
    seed: "const value = input as string;",
    coFire: [],
  },
  {
    ruleId: "agent-code-guard/no-enum-boolean-coercion",
    seed: "enum State { OFF, ON }\nconst state: State = State.OFF;\nif (state) {}",
    coFire: [],
  },
];
