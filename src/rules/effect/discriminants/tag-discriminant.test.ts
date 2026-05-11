import { createTypedRuleTester } from "../../utils/typed-linter/test-support/rule-tester.js";
import rule from "./tag-discriminant.js";

const ruleTester = createTypedRuleTester();

const filename = "src/rules/utils/typed-linter/test-support/fixture.ts";

const OPTION_DECL = `
  type Some<A> = { readonly _tag: "Some"; readonly value: A };
  type None = { readonly _tag: "None" };
  type Option<A> = Some<A> | None;
`;

const EITHER_DECL = `
  type Left<E> = { readonly _tag: "Left"; readonly left: E };
  type Right<A> = { readonly _tag: "Right"; readonly right: A };
  type Either<A, E> = Left<E> | Right<A>;
`;

const EFFECT_ERROR_DECL = `
  type WebhookTimeoutError = { readonly _tag: "WebhookTimeoutError"; readonly cause: string };
  type RpcTimeoutError = { readonly _tag: "RpcTimeoutError"; readonly cause: string };
  type Effect<A, E = never, R = never> = { readonly _A: A; readonly _E: E; readonly _R: R };
`;

ruleTester.run("tag-discriminant", rule, {
  valid: [
    {
      // Non-Effect tagged union (custom user type) — not flagged
      code: `
        type ClickAction = { readonly _tag: "click"; readonly id: string };
        type HoverAction = { readonly _tag: "hover"; readonly id: string };
        type Action = ClickAction | HoverAction;
        declare const action: Action;
        if (action._tag === "click") {}
      `,
      filename,
    },
    {
      // Redux-style action shape with _tag — not Effect-flavored, not flagged
      code: `
        type StoreAction = { readonly _tag: "fetch.start" } | { readonly _tag: "fetch.done" };
        declare const action: StoreAction;
        switch (action._tag) { case "fetch.start": break; default: break; }
      `,
      filename,
    },
    {
      // Effect.catchTag — not a manual _tag check
      code: `
        const out = { catchTag: (_t: string, _f: () => void) => null };
        out.catchTag("WebhookTimeoutError", () => {});
      `,
      filename,
    },
    {
      // `_tag` accessed via computed string — not a static _tag member
      code: `${EFFECT_ERROR_DECL}
        declare const err: WebhookTimeoutError;
        if (err["_tag"] === "WebhookTimeoutError") {}
      `,
      filename,
    },
    {
      // Concatenation, not comparison
      code: `${EFFECT_ERROR_DECL}
        declare const err: WebhookTimeoutError;
        const decorated = err._tag + "WebhookTimeoutError";
      `,
      filename,
    },
    {
      // Both sides have _tag access — not a string-literal comparison
      code: `${EFFECT_ERROR_DECL}
        declare const err: WebhookTimeoutError;
        declare const other: WebhookTimeoutError;
        if (err._tag === other._tag) {}
      `,
      filename,
    },
    {
      // Right side is not a string literal
      code: `${EFFECT_ERROR_DECL}
        declare const err: WebhookTimeoutError;
        declare const expectedTag: string;
        if (err._tag === expectedTag) {}
      `,
      filename,
    },
    {
      // Switch with no string cases
      code: `${EFFECT_ERROR_DECL}
        declare const err: WebhookTimeoutError;
        switch (err._tag) { default: break; }
      `,
      filename,
    },
    {
      // Different property name
      code: `${EFFECT_ERROR_DECL}
        declare const err: { readonly name: string };
        if (err.name === "TimeoutError") {}
      `,
      filename,
    },
    {
      // User-named tagged error type that doesn't actually extend an Effect
      // tagged-error class — the rule needs Effect-flavored types, not just
      // error-shaped naming. Real Effect code would extend Data.TaggedError.
      code: `${EFFECT_ERROR_DECL}
        declare const err: WebhookTimeoutError | RpcTimeoutError;
        if (err._tag === "WebhookTimeoutError") {}
      `,
      filename,
    },
    {
      // Same — synthetic error-shaped types are out of scope.
      code: `${EFFECT_ERROR_DECL}
        declare const err: WebhookTimeoutError;
        if ("WebhookTimeoutError" === err._tag) {}
      `,
      filename,
    },
  ],
  invalid: [
    {
      // Option._tag === "None" — Effect Option, fires
      code: `${OPTION_DECL}
        declare const opt: Option<number>;
        if (opt._tag === "None") {}
      `,
      filename,
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      // Option._tag === "Some" via switch — fires
      code: `${OPTION_DECL}
        declare const opt: Option<number>;
        switch (opt._tag) { case "Some": break; default: break; }
      `,
      filename,
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      // Either._tag === "Left" — Effect Either, fires
      code: `${EITHER_DECL}
        declare const result: Either<number, string>;
        if (result._tag === "Left") {}
      `,
      filename,
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      // Reversed operand order on an Effect-flavored type
      code: `${EITHER_DECL}
        declare const result: Either<number, string>;
        if ("Left" === result._tag) {}
      `,
      filename,
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      // Inequality operator on an Effect-flavored type
      code: `${OPTION_DECL}
        declare const opt: Option<number>;
        if (opt._tag !== "None") {}
      `,
      filename,
      errors: [{ messageId: "tagDiscriminant" }],
    },
    {
      // Switch on Effect-typed Either
      code: `${EITHER_DECL}
        declare const result: Either<number, string>;
        switch (result._tag) { case "Left": break; default: break; }
      `,
      filename,
      errors: [{ messageId: "tagDiscriminant" }],
    },
  ],
});
