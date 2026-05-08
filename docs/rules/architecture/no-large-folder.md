# `agent-code-guard/no-large-folder`

**What it flags:** Folders with too many direct production/semantic
children, or too many direct children once tests are included.

Defaults: more than 10 direct production children, more than 20 direct
children including tests, or more than 20 direct unpaired test children.

**Why:** Package trees get fat before they get obviously tangled. A folder
with 30 direct files is usually hiding several concepts under one name.
Tests are not free either: colocated 1:1 tests get room under the
including-tests budget, but a flat `tests/` folder can become the same junk
drawer.

This rule warns because size is a design smell, not a proof of a bad
boundary. It is meant to force a folder-shape conversation early.

## Before (flagged)

```text
src/rules/
├── async-keyword.ts
├── bare-catch.ts
├── effect-promise.ts
├── ...
└── tag-discriminant.ts
```

Every new rule lands as another direct child. The folder no longer tells you
which rule families exist.

## After (preferred)

```text
src/rules/
├── effect/
│   ├── effect-promise.ts
│   └── effect-error-erasure.ts
├── architecture/
│   ├── no-folder-cycle.ts
│   └── no-package-mesh.ts
└── testing/
    ├── no-test-skip-only.ts
    └── no-example-only-tests.ts
```

The tree names the concepts, not just the inventory.

## Test pairing

Colocated tests that match a production child do not increase the production
child count:

```text
src/rules/no-raw-sql.ts
src/rules/no-raw-sql.test.ts
```

All test children count toward the including-tests budget. An unpaired test
child also counts toward the unpaired-test budget:

```text
tests/no-raw-sql-regression.test.ts
```

That keeps dedicated test folders honest without punishing normal 1:1
implementation tests.

## Options

```js
{
  "agent-code-guard/no-large-folder": ["warn", {
    // Direct production/semantic children allowed per folder. Default: 10.
    maxFolderChildren: 10,

    // Direct production + test children allowed per folder. Default: 20.
    maxFolderChildrenIncludingTests: 20,

    // Direct test children with no matching production child. Default: 20.
    // Useful when you raise the total budget but still want standalone tests capped.
    maxUnpairedTestChildren: 20,

    // Per-folder budgets. Each override requires a written reason.
    folderChildCountOverrides: [
      {
        folder: "rules/architecture",
        maxChildren: 12,
        maxChildrenIncludingTests: 24,
        reason: "temporary migration folder while architecture rules split by boundary level",
      },
    ],
  }]
}
```

Generated files are ignored automatically. `index.ts` and configured
`facadeFiles` do not count as direct file children.
