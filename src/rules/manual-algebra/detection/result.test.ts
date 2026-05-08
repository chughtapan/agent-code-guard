import * as fc from "fast-check";
import { expect, it } from "vitest";
import { findManualResultMatch } from "./index.js";
import { parseSubject } from "./test-support/fixtures.js";

const EXTENDED_RESULT_CASES = [
  ["error", "const error = <E>(error: E) => ({ ok: false as const, error });"],
  ["left", 'const left = <L>(left: L) => ({ _tag: "Left" as const, left });'],
  ["right", 'const right = <R>(right: R) => ({ _tag: "Right" as const, right });'],
  ["success", 'const success = <T>(success: T) => ({ _tag: "Success" as const, success });'],
  ["failure", "const failure = <E>(failure: E) => ({ failure });"],
  ["isOk", "const isOk = (input: { ok: boolean }) => input.ok;"],
  ["isErr", "const isErr = (input: { error?: Error }) => input.error;"],
  ["isLeft", 'const isLeft = (input: { _tag: "Left" | "Right" }) => input._tag === "Left";'],
  ["isRight", 'const isRight = (input: { _tag: "Left" | "Right" }) => input._tag === "Right";'],
  ["isSuccess", "const isSuccess = (input: { success?: number }) => input.success;"],
  ["isFailure", "const isFailure = (input: { failure?: Error }) => input.failure;"],
] as const;

const MISMATCHED_RESULT_HELPERS = [
  'const error = () => ({ _tag: "Missing" as const });',
  'const left = () => ({ _tag: "Missing" as const });',
  'const right = () => ({ _tag: "Missing" as const });',
  'const success = () => ({ _tag: "Missing" as const });',
  'const failure = () => ({ _tag: "Missing" as const });',
  "const isOk = (input: { value?: number }) => input.value;",
  "const isErr = (input: { value?: number }) => input.value;",
  'const isLeft = (input: { _tag: "Some" }) => input._tag === "Some";',
  'const isRight = (input: { _tag: "Some" }) => input._tag === "Some";',
  "const isSuccess = (input: { value?: number }) => input.value;",
  "const isFailure = (input: { value?: number }) => input.value;",
] as const;

it("requires reusable result helper names before flagging a function helper", () => {
  const neutral = parseSubject(
    "function project<T>(value: T) { return { ok: true as const, value }; }",
  );
  const reusable = parseSubject(
    "function ok<T>(value: T) { return { ok: true as const, value }; }",
  );

  expect(findManualResultMatch(neutral)).toBeNull();
  expect(findManualResultMatch(reusable)?.displayName).toBe("ok");
});

it("keeps `ok` and `err` helper names clean when branch evidence is incomplete", () => {
  const ok = parseSubject("function ok() { return { ok: false as const }; }");
  const err = parseSubject("const err = () => ({ ok: true as const });");
  const error = parseSubject("const error = () => ({ ok: true as const });");

  expect(findManualResultMatch(ok)).toBeNull();
  expect(findManualResultMatch(err)).toBeNull();
  expect(findManualResultMatch(error)).toBeNull();
});

it("recognizes `ok` helpers without relying on a boolean literal", () => {
  const node = parseSubject("const ok = (ok: number, value: number) => ({ ok, value });");

  expect(findManualResultMatch(node)?.displayName).toBe("ok");
});

it("recognizes `err` and `error` helpers through their dedicated evidence paths", () => {
  const errByKey = parseSubject("const err = (input: { err?: Error }) => input.err;");
  const errByFalse = parseSubject("const err = () => ({ ok: false as const });");
  const errorByKey = parseSubject("const error = (input: { error?: Error }) => input.error;");

  expect(findManualResultMatch(errByKey)?.displayName).toBe("err");
  expect(findManualResultMatch(errByFalse)?.displayName).toBe("err");
  expect(findManualResultMatch(errorByKey)?.displayName).toBe("error");
});

it("recognizes the extended result helper names", () => {
  for (const [expectedName, code] of EXTENDED_RESULT_CASES) {
    expect(findManualResultMatch(parseSubject(code))?.displayName).toBe(expectedName);
  }
});

it("keeps result helper names clean when their evidence does not match", () => {
  for (const code of MISMATCHED_RESULT_HELPERS) {
    expect(findManualResultMatch(parseSubject(code))).toBeNull();
  }
});

it("keeps reusable result helpers clean when only unrelated branch evidence is present", () => {
  const match = parseSubject("const match = (input: { tch?: string }) => input.tch;");
  const outcome = parseSubject("function Outcome(input: { tcome?: string }) { return input.tcome; }");

  expect(findManualResultMatch(match)).toBeNull();
  expect(findManualResultMatch(outcome)).toBeNull();
});

it("requires complete left/right evidence pairs on neutral result-like surfaces", () => {
  const leftOnly = parseSubject("type helpers = { readonly left: string };");
  const rightOnly = parseSubject("type helpers = { readonly right: string };");

  expect(findManualResultMatch(leftOnly)).toBeNull();
  expect(findManualResultMatch(rightOnly)).toBeNull();
});

it("requires complete ok-based evidence on result-like surfaces", () => {
  const okOnly = parseSubject("type Outcome = { readonly ok: true };");
  const issueOnly = parseSubject("type Outcome = { readonly ok: true; readonly issue: string };");
  const withError = parseSubject("type Outcome = { readonly ok: true; readonly error: string };");
  const withErr = parseSubject("type Outcome = { readonly ok: true; readonly err: string };");
  const withValue = parseSubject("type Outcome = { readonly ok: true; readonly value: string };");

  expect(findManualResultMatch(okOnly)).toBeNull();
  expect(findManualResultMatch(issueOnly)).toBeNull();
  expect(findManualResultMatch(withError)?.displayName).toBe("Outcome");
  expect(findManualResultMatch(withErr)?.displayName).toBe("Outcome");
  expect(findManualResultMatch(withValue)?.displayName).toBe("Outcome");
});

it("still flags non-function result surfaces that rely on branch pairs", () => {
  const typeAlias = parseSubject(
    "type Ok<E> = { readonly ok: false; readonly error: E } | { readonly ok: false; readonly err: E };",
  );

  expect(findManualResultMatch(typeAlias)?.displayName).toBe("Ok");
});

it("Property: result helper detection follows helper names and matching evidence", () => {
  fc.assert(
    fc.property(fc.constantFrom(...EXTENDED_RESULT_CASES), ([expectedName, code]) => {
      const matching = parseSubject(code);
      const mismatched = parseSubject(mismatchedResultHelperSource(expectedName));

      expect(findManualResultMatch(matching)?.displayName).toBe(expectedName);
      expect(findManualResultMatch(mismatched)).toBeNull();
    }),
    { numRuns: 60 },
  );
});

function mismatchedResultHelperSource(helperName: string): string {
  return `const ${helperName} = () => ({ _tag: "Missing" as const });`;
}
