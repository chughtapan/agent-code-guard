# `agent-code-guard/no-vacuous-jsdoc`

Rejects a small, closed grammar of JSDoc filler. The rule does not attempt to decide whether prose is generally meaningful, and it does not fix source or offer suggestions.

It checks every JSDoc block description and the description of `@param`, `@arg`, `@argument`, `@returns`, `@return`, `@property`, `@prop`, `@throws`, and `@exception`.

The comparison trims prose, collapses whitespace, folds ASCII case, and ignores one final period. It rejects only `TODO`, `TBD`, `FIXME`, `XXX`, `N/A`, `none`, `unknown`, `no description`, and the approved finite filler templates:

- `The <name> result`
- `Value supplied to the operation`
- `Provides the <name> runtime value`
- `Executes the <name> operation`
- `Represents <name> values`
- `Name of the operation`
- `Re-exports the public API from current module`
- `Protocol definition to process`

`<name>` is accepted only from the directly attached declaration or the parser-derived name of a `@param`/`@arg`/`@argument`/`@property`/`@prop` tag. It never follows aliases, exports, enclosing declarations, or detached comments.

## Flagged

```ts
/**
 * @returns TBD
 */
function read(): string {
  return "id";
}
```

## Valid

```ts
/**
 * @returns The durable identifier stored for this record.
 */
function read(): string {
  return "id";
}
```
