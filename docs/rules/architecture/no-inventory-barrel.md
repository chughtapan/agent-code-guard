# `agent-code-guard/no-inventory-barrel`

**What it flags:** `index.ts` files that export most eligible sibling modules in
the same folder.

Default threshold: at least 4 exported sibling modules and at least 60% of
eligible sibling modules. Test, story, generated, declaration, hidden, and
non-indexed folder siblings do not count as eligible modules.

**Why:** A barrel that exports the folder inventory is not an abstraction. It
makes every future sibling export part of the boundary and hides no design
decision.

## Before (flagged)

```ts
export { createUser } from "./create-user";
export { deleteUser } from "./delete-user";
export { UserRepository } from "./repository";
export { UserSqlMapper } from "./sql-mapper";
```

## After (preferred)

```ts
export type { UserService, UserServiceError } from "./service";
export { makeUserService } from "./service";
```

Expose the contract consumers need: ports, factories, stable value objects, and
domain errors. Keep concrete helpers and implementation files private.

## Options

```js
{
  "agent-code-guard/no-inventory-barrel": ["warn", {
    minExportedSiblingModules: 4,
    maxExportedSiblingRatio: 0.6,
    countTypeOnlyExports: true
  }]
}
```

## Exceptions

Generated API folders may suppress this rule with a written reason. For hand
written code, prefer a named facade over a broad barrel.
