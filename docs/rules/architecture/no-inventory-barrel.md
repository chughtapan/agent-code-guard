# `agent-code-guard/no-inventory-barrel`

**What it flags:** `index.ts` files that re-export most of their sibling
modules — by default, when an `index.ts` exports at least 4 sibling modules
AND those exports cover at least 60% of eligible siblings.

"Eligible siblings" excludes test files (`*.test.*`, `*.spec.*`),
declaration files (`*.d.ts`), generated files, hidden files, and stories.

**Why:** A barrel that exports the folder inventory is not an abstraction.
It says "here is everything that happens to live in this folder," not "here
is the contract this module offers." Every new sibling file silently joins
the public surface; every refactor that moves files becomes a breaking
change.

The 60% threshold is a heuristic — pure utility modules (where everything
IS the public API) are the legitimate exception. The rule warns rather
than errors precisely because this is judgment-dependent.

## Before (flagged)

```
src/users/
├── index.ts          ← re-exports 4 of 5 siblings (80% — flagged)
├── create-user.ts
├── delete-user.ts
├── repository.ts
├── sql-mapper.ts
└── user.types.ts
```

```ts
// src/users/index.ts
export { createUser } from "./create-user";
export { deleteUser } from "./delete-user";
export { UserRepository } from "./repository";
export { UserSqlMapper } from "./sql-mapper";
```

This barrel publishes the implementation file structure as API. Want to
extract `repository.ts` into `repository/index.ts` + helpers? Breaking
change.

## After (preferred) — curated facade

```ts
// src/users/index.ts
export type { UserService, UserServiceError } from "./service";
export { makeUserService } from "./service";
```

Now the public surface of `users/` is one type and one factory. The
filesystem can be reorganized freely behind that.

## After (preferred) — make the folder genuinely a utility module

If this folder really is a flat collection of utilities (e.g., `src/utils/`
with `formatDate`, `parseUrl`, `clamp`), then the barrel IS the contract —
that's the legitimate case. Either accept the warn for that file, or
suppress per-file with a note acknowledging the tradeoff.

## Options

```js
{
  "agent-code-guard/no-inventory-barrel": ["warn", {
    // Minimum exported siblings before the rule even considers firing.
    // Below this, even a 100% ratio is fine — it's just a small barrel.
    // Default: 4.
    minExportedSiblingModules: 4,

    // Maximum acceptable ratio of exported : total eligible siblings.
    // 0.6 = "if you re-export more than 60% of siblings, that's inventory."
    // Default: 0.6.
    maxExportedSiblingRatio: 0.6,

    // Whether type-only exports (`export type {...}`) count toward the
    // ratio. Default: true (they're still public-surface decisions).
    countTypeOnlyExports: true,
  }]
}
```

## Suppressing per-file via a directive

For genuine utility modules where the barrel IS the contract, suppress the
rule for that file with a written reason:

```ts
// @agent-code-guard/architecture-exception: no-inventory-barrel
// reason: src/string-utils/ is a flat utility module by design

export { formatDate } from "./format-date";
export { parseUrl } from "./parse-url";
export { clamp } from "./clamp";
// ... and so on
```

The `reason:` line is required; missing reasons surface as
`architecture-directive-parse-error` diagnostics.

If you find yourself directive-suppressing on multiple folders, consider
raising `maxExportedSiblingRatio` to 0.8 or higher repo-wide rather than
scattering directives. The rule is meant to catch accidental inventory
barrels in domain folders, not utility hubs.

## Rationale

Barrels and curated facades look similar but mean opposite things. A
facade hides design decisions; an inventory barrel publishes them. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full curation treatment.
