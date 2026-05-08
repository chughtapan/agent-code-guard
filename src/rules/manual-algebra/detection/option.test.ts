import * as fc from "fast-check";
import { expect, it } from "vitest";
import {
  findManualBrandMatch,
  findManualOptionMatch,
  findManualResultMatch,
  isTaggedErrorCollision,
} from "./index.js";
import { parseSubject } from "./test-support/fixtures.js";

const optionHelperArb = fc.constantFrom("some", "none", "present", "absent");

it("keeps neutral option branch-pair surfaces clean", () => {
  const node = parseSubject("const cache = { some: 1, none: null };");

  expect(findManualOptionMatch(node)).toBeNull();
});

it("requires complete option key pairs on option-like surfaces", () => {
  const someOnly = parseSubject("type Option = { readonly some: number };");
  const noneOnly = parseSubject("type Option = { readonly none: null };");

  expect(findManualOptionMatch(someOnly)).toBeNull();
  expect(findManualOptionMatch(noneOnly)).toBeNull();
});

it("recognizes the extended option helper names", () => {
  const present = parseSubject('const present = <T>(value: T) => ({ _tag: "Present" as const, value });');
  const absent = parseSubject('const absent = () => ({ _tag: "Absent" as const });');
  const hasValue = parseSubject("const hasValue = (option: { value?: number }) => option.value;");
  const isNone = parseSubject(
    'const isNone = (option: { _tag: "None" | "Some" }) => option._tag === "None";',
  );

  expect(findManualOptionMatch(present)?.displayName).toBe("present");
  expect(findManualOptionMatch(absent)?.displayName).toBe("absent");
  expect(findManualOptionMatch(hasValue)?.displayName).toBe("hasValue");
  expect(findManualOptionMatch(isNone)?.displayName).toBe("isNone");
});

it("keeps helper-like option names clean when the evidence does not match", () => {
  const present = parseSubject('const present = () => ({ _tag: "Missing" as const });');
  const absent = parseSubject('const absent = () => ({ _tag: "Missing" as const });');
  const hasValue = parseSubject("const hasValue = (option: { current?: number }) => option.current;");
  const isNone = parseSubject('const isNone = (option: { _tag: "Some" }) => option._tag === "Some";');

  expect(findManualOptionMatch(present)).toBeNull();
  expect(findManualOptionMatch(absent)).toBeNull();
  expect(findManualOptionMatch(hasValue)).toBeNull();
  expect(findManualOptionMatch(isNone)).toBeNull();
});

it("recognizes the base option helper names", () => {
  const some = parseSubject('const some = <T>(value: T) => ({ _tag: "Some" as const, value });');
  const none = parseSubject('const none = () => ({ _tag: "None" as const });');
  const isSome = parseSubject("const isSome = (option: { value?: number }) => option.value;");

  expect(findManualOptionMatch(some)?.displayName).toBe("some");
  expect(findManualOptionMatch(none)?.displayName).toBe("none");
  expect(findManualOptionMatch(isSome)?.displayName).toBe("isSome");
});

it("keeps the base option helper names clean when evidence does not match", () => {
  const some = parseSubject('const some = () => ({ _tag: "Missing" as const });');
  const none = parseSubject('const none = () => ({ _tag: "Missing" as const });');
  const isSome = parseSubject("const isSome = (option: { current?: number }) => option.current;");

  expect(findManualOptionMatch(some)).toBeNull();
  expect(findManualOptionMatch(none)).toBeNull();
  expect(findManualOptionMatch(isSome)).toBeNull();
});

it("still flags non-function option surfaces that rely on branch pairs", () => {
  const typeAlias = parseSubject("type Some<T> = { readonly some: T; readonly none: null };");

  expect(findManualOptionMatch(typeAlias)?.displayName).toBe("Some");
});

it("keeps reusable option helpers clean when only `None` evidence is present", () => {
  const option = parseSubject('const Option = () => ({ _tag: "None" as const });');
  const match = parseSubject('const match = () => ({ _tag: "None" as const });');

  expect(findManualOptionMatch(option)).toBeNull();
  expect(findManualOptionMatch(match)).toBeNull();
});

it("requires reusable option helper names before flagging a function helper", () => {
  const neutral = parseSubject(
    'function select<T>(value: T) { return { _tag: "Some" as const, value }; }',
  );
  const reusable = parseSubject(
    'const some = <T>(value: T) => ({ _tag: "Some" as const, value });',
  );

  expect(findManualOptionMatch(neutral)).toBeNull();
  expect(findManualOptionMatch(reusable)?.displayName).toBe("some");
});

it("covers type, interface, and class surfaces directly", () => {
  const resultType = parseSubject(
    "type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };",
  );
  const resultInterface = parseSubject(
    "interface Result<T, E> { readonly ok: true; readonly value: T; match(input: T, error: E): unknown; }",
  );
  const optionClass = parseSubject("class Option { some() { return 1; } none() { return null; } }");
  const brandType = parseSubject('type UserId = string & { readonly __brand: "UserId" };');

  expect(findManualResultMatch(resultType)?.displayName).toBe("Result");
  expect(findManualResultMatch(resultInterface)?.displayName).toBe("Result");
  expect(findManualOptionMatch(optionClass)?.displayName).toBe("Option");
  expect(findManualBrandMatch(brandType)?.displayName).toBe("UserId");
});

it("keeps unsupported type, class, and declarator surfaces clean", () => {
  const scalarType = parseSubject("type Result = number;");
  const indexInterface = parseSubject("interface Result { [key: string]: unknown; }");
  const classWithStaticBlock = parseSubject("class Result { static { void 0; } }");
  const callInitializer = parseSubject("const Result = makeResult();");
  const destructured = parseSubject("const { Result } = helpers;");

  expect(findManualResultMatch(scalarType)).toBeNull();
  expect(findManualResultMatch(indexInterface)).toBeNull();
  expect(findManualResultMatch(classWithStaticBlock)).toBeNull();
  expect(findManualResultMatch(callInitializer)).toBeNull();
  expect(findManualResultMatch(destructured)).toBeNull();
});

it("uses method signatures as reusable signals when properties are absent", () => {
  const resultInterface = parseSubject("interface helpers { left(): string; right(): string; match(): unknown; }");
  const optionInterface = parseSubject("interface helpers { some(): number; none(): null; flatMap(): unknown; }");

  expect(findManualResultMatch(resultInterface)?.displayName).toBe("helpers");
  expect(findManualOptionMatch(optionInterface)?.displayName).toBe("helpers");
});

it("exempts option-like tagged errors that would otherwise match", () => {
  const node = parseSubject(
    'type OptionFailure<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };',
  );

  expect(isTaggedErrorCollision(node)).toBe(true);
  expect(findManualOptionMatch(node)).toBeNull();
});

it("Property: option helper detection follows helper names and matching evidence", () => {
  fc.assert(
    fc.property(optionHelperArb, (helperName) => {
      const matching = parseSubject(optionHelperSource(helperName));
      const mismatched = parseSubject(mismatchedOptionHelperSource(helperName));

      expect(findManualOptionMatch(matching)?.displayName).toBe(helperName);
      expect(findManualOptionMatch(mismatched)).toBeNull();
    }),
    { numRuns: 60 },
  );
});

function optionHelperSource(helperName: string): string {
  return OPTION_HELPER_SOURCES[helperName] ??
    'const some = (value: number) => ({ _tag: "Some" as const, value });';
}

function mismatchedOptionHelperSource(helperName: string): string {
  return `const ${helperName} = () => ({ _tag: "Missing" as const });`;
}

const OPTION_HELPER_SOURCES: Record<string, string> = {
  some: 'const some = (value: number) => ({ _tag: "Some" as const, value });',
  none: 'const none = () => ({ _tag: "None" as const });',
  present: 'const present = (value: number) => ({ _tag: "Present" as const, value });',
  absent: 'const absent = () => ({ _tag: "Absent" as const });',
};
