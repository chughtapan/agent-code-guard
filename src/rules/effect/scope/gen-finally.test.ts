/**
 * @file Verifies try/finally is reported only when the nearest enclosing function is a generator Effect drives.
 */

import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { genFinally as rule } from "./gen-finally.js";

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

ruleTester.run("gen-finally", rule, {
  valid: [
    {
      name: "plain generator",
      code: `
        function* items() {
          try {
            yield 1;
          } finally {
            close();
          }
        }
      `,
    },
    {
      name: "plain generator expression passed to an unrelated call",
      code: `
        const stream = Stream.fromIterable(function* () {
          try {
            yield 1;
          } finally {
            close();
          }
        });
      `,
    },
    {
      name: "try/catch without finally in Effect.gen",
      code: `
        const program = Effect.gen(function* () {
          try {
            return parse(input);
          } catch (cause) {
            return yield* Effect.fail(new ParseError({ cause }));
          }
        });
      `,
    },
    {
      name: "nested plain generator inside Effect.gen",
      code: `
        const program = Effect.gen(function* () {
          function* items() {
            try {
              yield 1;
            } finally {
              close();
            }
          }
          return yield* consume(items());
        });
      `,
    },
    {
      name: "arrow function inside Effect.gen",
      code: `
        const program = Effect.gen(function* () {
          const read = () => {
            try {
              return readSync();
            } finally {
              close();
            }
          };
          return yield* Effect.sync(read);
        });
      `,
    },
    {
      name: "function expression inside Effect.fn",
      code: `
        const load = Effect.fn("load")(function* () {
          const read = function () {
            try {
              return readSync();
            } finally {
              close();
            }
          };
          return yield* Effect.sync(read);
        });
      `,
    },
    {
      name: "non-generator function passed to Effect.fn",
      code: `
        const load = Effect.fn("load")(function () {
          try {
            return Effect.succeed(readSync());
          } finally {
            close();
          }
        });
      `,
    },
    {
      name: "generator driven by another namespace",
      code: `
        const value = Option.gen(function* () {
          try {
            return yield* lookup;
          } finally {
            close();
          }
        });
      `,
    },
    {
      name: "generator passed to a curried call that is not Effect.fn",
      code: `
        const load = Effect.withSpan("load")(function* () {
          try {
            yield* work;
          } finally {
            close();
          }
        });
      `,
    },
    {
      name: "generator stored before Effect.gen receives it",
      code: `
        const body = function* () {
          try {
            yield* work;
          } finally {
            close();
          }
        };
        const program = Effect.gen(body);
      `,
    },
  ],
  invalid: [
    {
      name: "try/finally in Effect.gen",
      code: `
        const program = Effect.gen(function* () {
          try {
            yield* work;
          } finally {
            close();
          }
        });
      `,
      errors: [{ messageId: "genFinally", line: 3 }],
    },
    {
      name: "try/catch/finally in Effect.gen",
      code: `
        const program = Effect.gen(function* () {
          try {
            yield* work;
          } catch (cause) {
            report(cause);
          } finally {
            close();
          }
        });
      `,
      errors: [{ messageId: "genFinally" }],
    },
    {
      name: "Effect.gen with a this argument",
      code: `
        const program = Effect.gen(this, function* () {
          try {
            yield* work;
          } finally {
            close();
          }
        });
      `,
      errors: [{ messageId: "genFinally" }],
    },
    {
      name: "named Effect.fn",
      code: `
        const load = Effect.fn("load")(function* (id: string) {
          try {
            return yield* fetchUser(id);
          } finally {
            close();
          }
        });
      `,
      errors: [{ messageId: "genFinally" }],
    },
    {
      name: "unnamed Effect.fn",
      code: `
        const load = Effect.fn(function* (id: string) {
          try {
            return yield* fetchUser(id);
          } finally {
            close();
          }
        });
      `,
      errors: [{ messageId: "genFinally" }],
    },
    {
      name: "Effect.fnUntraced",
      code: `
        const load = Effect.fnUntraced(function* (id: string) {
          try {
            return yield* fetchUser(id);
          } finally {
            close();
          }
        });
      `,
      errors: [{ messageId: "genFinally" }],
    },
    {
      name: "try nested in a block of the generator",
      code: `
        const program = Effect.gen(function* () {
          for (const item of items) {
            if (item.ready) {
              try {
                yield* run(item);
              } finally {
                close(item);
              }
            }
          }
        });
      `,
      errors: [{ messageId: "genFinally", line: 5 }],
    },
    {
      name: "Effect.gen nested inside a plain generator",
      code: `
        function* outer() {
          yield Effect.gen(function* () {
            try {
              yield* work;
            } finally {
              close();
            }
          });
        }
      `,
      errors: [{ messageId: "genFinally" }],
    },
    {
      name: "Effect.gen nested inside an arrow function",
      code: `
        const run = () =>
          Effect.gen(function* () {
            try {
              yield* work;
            } finally {
              close();
            }
          });
      `,
      errors: [{ messageId: "genFinally" }],
    },
    {
      name: "one report per try statement",
      code: `
        const program = Effect.gen(function* () {
          try {
            yield* first;
          } finally {
            closeFirst();
          }
          try {
            yield* second;
          } finally {
            closeSecond();
          }
        });
      `,
      errors: [{ messageId: "genFinally" }, { messageId: "genFinally" }],
    },
  ],
});
