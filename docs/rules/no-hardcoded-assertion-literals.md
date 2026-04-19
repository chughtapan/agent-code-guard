# `safer-by-default/no-hardcoded-assertion-literals`

**What it flags:** In test files (`**/*.test.*`, `**/*.spec.*`, `**/tests/**`, `**/__tests__/**`): string or number literals passed directly to assertion matchers (`.toBe`, `.toEqual`, `.toStrictEqual`, `.toContain`, `.toMatch`, `assert.equal`, `assert.strictEqual`, `assert.deepEqual`, `assertEquals`, `assertEqual`).

Allowed: strings shorter than `allowShorterThan` (default: 4 chars), boundary numbers (`-1, 0, 1, 2`), named constants, imported values, enum members, and regex arguments to `.toMatch`.

## Before (flagged)

```ts
expect(result).toBe("processed");         // string literal
expect(count).toBe(42);                    // magic number
assert.equal(status, "active");            // chai/assert style
assertEquals(value, "completed");          // Deno/custom style
expect(result).toStrictEqual(`pending`);   // template literal without substitution
```

## After (preferred)

```ts
// Make the contract explicit — prod and test import the same constant
import { STATUS } from "./constants";
expect(result).toBe(STATUS.Processed);

// Or assert a structural property
expect(count).toBeGreaterThan(0);
expect(arr.length).toBe(0);   // boundary numbers are allowed
```

## Options

`{ allowShorterThan?: number }` — default `4`. Allows strings with fewer characters than the threshold (e.g., `"ok"`, `"no"`, `"id"`).

```js
rules: {
  "safer-by-default/no-hardcoded-assertion-literals": ["warn", { allowShorterThan: 6 }],
}
```

## Install pattern

```js
// eslint.config.js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  // Test files — test-hygiene rules
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts", "**/tests/**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { "safer-by-default": guard },
    rules: {
      "safer-by-default/no-test-skip-only": "error",
      "safer-by-default/no-hardcoded-assertion-literals": "warn",
    },
  },
];
```

## Rationale

`expect(result).toBe("processed")` ties the test to a string with no named contract. If `"processed"` is part of the public API, it should be an exported constant — both the implementation and the test import it. If it is NOT contractual, the test should assert a structural property (`toBeNull()`, `toHaveLength(0)`) instead of exact content.
