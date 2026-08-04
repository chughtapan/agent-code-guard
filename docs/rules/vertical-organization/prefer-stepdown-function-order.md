# `agent-code-guard/prefer-stepdown-function-order`

This non-fixing rule keeps a file's function narrative in caller-before-callee
order without pretending that rearranging declarations is automatically safe.

It first reports independent story-band violations:

- Top-level exported functions precede unexported functions. A declaration is
  exported when it is directly exported, default exported, or named by a
  top-level local export specifier. Re-exports do not affect a local function.
- In each class body, constructors precede public/default-public/protected
  methods, which precede TypeScript `private` and ECMAScript `#private`
  methods.

The rule then considers only direct calls within the same band. A top-level
edge requires an unshadowed identifier that resolves to one eligible local
function declaration. A class edge requires `this.method()` or
`this.#method()` to name one own eligible method with matching staticness.
The class form is a navigation heuristic, not a claim about runtime dispatch.

Calls through aliases, imports, globals, computed members, `super`, optional
calls, inherited/class-qualified calls, and cross-file targets are ignored.
Nested functions, arrows, callbacks, function expressions, decorated methods,
accessors, fields, static blocks, abstract/signature-only methods, and overload
signatures are also excluded. Overload implementations remain eligible; their
signatures attach to that implementation rather than becoming graph vertices.

The graph deduplicates repeated calls, retains the earliest callsite for a
diagnostic, collapses cycles, and ignores intra-cycle edges. An edge is ordered
only when the caller component's last declaration occurs before the callee
component's first declaration. This keeps shared helpers below every caller
component and produces deterministic reports.

## Valid

```ts
export function loadUser() {
  return readUser();
}

function readUser() {
  return "user";
}
```

```ts
class Service {
  public run() {
    return this.read();
  }

  private read() {
    return "value";
  }
}
```

## Flagged

```ts
function readUser() {
  return "user";
}

export function loadUser() { // exported band must come first
  return readUser();
}
```

```ts
function readUser() {
  return "user";
}

function loadUser() {
  return readUser(); // caller must precede its callee
}
```
