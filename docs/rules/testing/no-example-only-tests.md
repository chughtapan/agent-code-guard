# `agent-code-guard/no-example-only-tests`

**What it flags:** test scopes that accumulate example cases without a
property or generative invariant test.

**Why:** examples are useful regression anchors. They become weak
coverage when a suite keeps adding fixed cases but never states the
invariant those cases imply. The point of the suite is to prove behavior
under all inputs that match the contract, not to memorize three.

This rule warns because some scopes are legitimately regression-only.
Mark those explicitly with a directive instead of disabling globally.

## Before (flagged)

```ts
it("accepts alice", () => {});
it("accepts bob", () => {});
it("accepts carol", () => {});
```

The suite proves three names are accepted. It does not prove the
function accepts what its contract says it accepts.

## After (preferred)

```ts
it("keeps one historical parser regression pinned", () => {});

fc.assert(
  fc.property(fc.string(), (value) => {
    expect(parse(render(value))).toEqual(value);
  }),
);
```

Property evidence is structural. A test title containing "property" is
not enough; the scope must call something like `fc.property`,
`fc.asyncProperty`, `it.prop`, or `test.prop`.

## Suppressing per-scope via a directive

```ts
// @agent-code-guard/regression-only: pins the exact production incident input
it("parses the legacy invoice id", () => {});
it("parses the legacy refund id", () => {});
```

Use this for scopes that are deliberately a list of pinned regressions.
The `regression-only:` comment is a written acknowledgment.

## Options

```js
"agent-code-guard/no-example-only-tests": ["warn", {
  minExamplesBeforeWarning: 2,
  propertyCallNames: ["fc.property", "fc.asyncProperty", "it.prop", "test.prop"],
  regressionOnlyCommentPattern: "@agent-code-guard/regression-only:",
  ignoreFilenamePatterns: ["[\\\\/]e2e[\\\\/]", "\\.snapshot\\.[cm]?[jt]sx?$"]
}]
```
