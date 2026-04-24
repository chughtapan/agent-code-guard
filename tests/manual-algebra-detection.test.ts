import * as tsParser from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { describe, expect, it } from "vitest";
import {
  findManualBrandMatch,
  findManualOptionMatch,
  findManualResultMatch,
  isTaggedErrorCollision,
  isTransportDataShape,
} from "../src/utils/manual-algebra-detection.js";

function parseSubject(code: string): TSESTree.Node {
  const program = tsParser.parse(code, {
    ecmaVersion: 2022,
    sourceType: "module",
  }) as TSESTree.Program;
  const statement = program.body[0];
  if (!statement) throw new Error(`expected a top-level statement in:\n${code}`);
  if (statement.type === AST_NODE_TYPES.VariableDeclaration) {
    const declarator = statement.declarations[0];
    if (!declarator) throw new Error(`expected a variable declarator in:\n${code}`);
    return declarator;
  }
  return statement;
}

describe("manual algebra detection", () => {
  it("returns false for nodes that do not form a supported surface", () => {
    const node = parseSubject("doThing();");

    expect(isTransportDataShape(node)).toBe(false);
    expect(isTaggedErrorCollision(node)).toBe(false);
  });

  it("exempts transport-shaped result aliases that would otherwise look manual", () => {
    const node = parseSubject(
      "type ResultResponse<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };",
    );

    expect(isTransportDataShape(node)).toBe(true);
    expect(findManualResultMatch(node)).toBeNull();
  });

  it("exempts transport-shaped state aliases that use result naming", () => {
    const node = parseSubject(
      "type ResultState<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };",
    );

    expect(isTransportDataShape(node)).toBe(true);
    expect(findManualResultMatch(node)).toBeNull();
  });

  it("exempts transport-shaped option aliases that would otherwise look manual", () => {
    const node = parseSubject(
      'type MaybeState<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };',
    );

    expect(isTransportDataShape(node)).toBe(true);
    expect(findManualOptionMatch(node)).toBeNull();
  });

  it("treats neutral discriminant unions as transport/data shapes", () => {
    const node = parseSubject(
      'type Session = { readonly status: "Loading" } | { readonly status: "Loaded"; readonly value: string };',
    );

    expect(isTransportDataShape(node)).toBe(true);
    expect(findManualResultMatch(node)).toBeNull();
    expect(findManualOptionMatch(node)).toBeNull();
  });

  it("treats `type` and `kind` discriminant unions as transport/data shapes", () => {
    const typeNode = parseSubject(
      'type Session = { readonly type: "Loading" } | { readonly type: "Loaded"; readonly value: string };',
    );
    const kindNode = parseSubject(
      'type Session = { readonly kind: "Loading" } | { readonly kind: "Loaded"; readonly value: string };',
    );

    expect(isTransportDataShape(typeNode)).toBe(true);
    expect(isTransportDataShape(kindNode)).toBe(true);
  });

  it("normalizes padded string keys when detecting transport/data discriminants", () => {
    const node = parseSubject(
      'type Session = { readonly " status ": "Loading" } | { readonly " status ": "Loaded"; readonly value: string };',
    );

    expect(isTransportDataShape(node)).toBe(true);
  });

  it("does not treat discriminant unions with helper keys as transport/data shapes", () => {
    const node = parseSubject(
      'type Session = { readonly status: "Loading"; readonly match: () => string } | { readonly status: "Loaded"; readonly value: string };',
    );

    expect(isTransportDataShape(node)).toBe(false);
  });

  it("exempts transport-shaped state aliases that use option naming", () => {
    const node = parseSubject(
      "type OptionState<T> = { readonly some: T; readonly none: null };",
    );

    expect(isTransportDataShape(node)).toBe(true);
    expect(findManualOptionMatch(node)).toBeNull();
  });

  it("exempts transport-shaped brand aliases that would otherwise look manual", () => {
    const node = parseSubject(
      'type UserIdPayload = string & { readonly __brand: "UserIdPayload" };',
    );

    expect(isTransportDataShape(node)).toBe(true);
    expect(findManualBrandMatch(node)).toBeNull();
  });

  it("exempts tagged error names from option detection", () => {
    const node = parseSubject(
      'type ParseFailure = { readonly _tag: "Some"; readonly value: string } | { readonly _tag: "None" };',
    );

    expect(isTaggedErrorCollision(node)).toBe(true);
    expect(findManualOptionMatch(node)).toBeNull();
  });

  it("exempts tagged error names from result detection", () => {
    const node = parseSubject(
      'type ParseFailure = { readonly _tag: "Left"; readonly left: string } | { readonly _tag: "Right"; readonly right: number };',
    );

    expect(isTaggedErrorCollision(node)).toBe(true);
    expect(findManualResultMatch(node)).toBeNull();
  });

  it("treats mixed tagged error literals as tagged-error collisions", () => {
    const node = parseSubject(
      'type Result = { readonly _tag: "ParseFailure"; readonly left: string } | { readonly _tag: "Right"; readonly right: number };',
    );

    expect(isTaggedErrorCollision(node)).toBe(true);
    expect(findManualResultMatch(node)).toBeNull();
  });

  it("requires a real tag key before treating a surface as a tagged-error collision", () => {
    const node = parseSubject(
      'type ParseFailure = { readonly label: "ParseFailure"; readonly message: string };',
    );

    expect(isTaggedErrorCollision(node)).toBe(false);
  });

  it("still flags result-like surfaces when error-like literals are not on `_tag`", () => {
    const node = parseSubject(
      'type Outcome<T, E> = { readonly status: "OperationFailure"; readonly ok: true; readonly value: T } | { readonly status: "Ready"; readonly ok: false; readonly error: E };',
    );

    expect(isTaggedErrorCollision(node)).toBe(false);
    expect(findManualResultMatch(node)?.displayName).toBe("Outcome");
  });

  it("requires brand helper names before flagging a cast helper", () => {
    const neutral = parseSubject(
      "const project = (value: string): UserId => value as UserId;",
    );
    const branded = parseSubject(
      "const asUserId = (value: string): UserId => value as UserId;",
    );

    expect(findManualBrandMatch(neutral)).toBeNull();
    expect(findManualBrandMatch(branded)?.displayName).toBe("asUserId");
  });

  it("requires a real brand marker before treating plain literals as brands", () => {
    const node = parseSubject(
      'type AgentName = { readonly label: "AgentName" };',
    );

    expect(findManualBrandMatch(node)).toBeNull();
  });

  it("does not flag cast helpers without an explicit return type or direct return", () => {
    const missingReturnType = parseSubject(
      "function asUserId(value: string) { return value as UserId; }",
    );
    const indirectReturn = parseSubject(
      "function asUserId(value: string): UserId { const next = value as UserId; return next; }",
    );

    expect(findManualBrandMatch(missingReturnType)).toBeNull();
    expect(findManualBrandMatch(indirectReturn)).toBeNull();
  });

  it("accepts all supported brand helper prefixes", () => {
    const directHelper = parseSubject(
      "const UserId = (value: string): UserId => value as UserId;",
    );
    const makeHelper = parseSubject(
      "const makeUserId = (value: string): UserId => value as UserId;",
    );
    const toHelper = parseSubject(
      "const toUserId = (value: string): UserId => value as UserId;",
    );
    const functionExpression = parseSubject(
      "const asUserId = function (value: string): UserId { return value as UserId; };",
    );

    expect(findManualBrandMatch(directHelper)?.displayName).toBe("UserId");
    expect(findManualBrandMatch(makeHelper)?.displayName).toBe("makeUserId");
    expect(findManualBrandMatch(toHelper)?.displayName).toBe("toUserId");
    expect(findManualBrandMatch(functionExpression)?.displayName).toBe("asUserId");
  });

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

  it("keeps `ok` and `err` helper names clean when the branch evidence is incomplete", () => {
    const ok = parseSubject(
      "function ok() { return { ok: false as const }; }",
    );
    const err = parseSubject(
      "const err = () => ({ ok: true as const });",
    );
    const error = parseSubject(
      "const error = () => ({ ok: true as const });",
    );

    expect(findManualResultMatch(ok)).toBeNull();
    expect(findManualResultMatch(err)).toBeNull();
    expect(findManualResultMatch(error)).toBeNull();
  });

  it("recognizes `ok` helpers without relying on a boolean literal", () => {
    const node = parseSubject(
      "const ok = (ok: number, value: number) => ({ ok, value });",
    );

    expect(findManualResultMatch(node)?.displayName).toBe("ok");
  });

  it("recognizes `err` and `error` helpers through their dedicated evidence paths", () => {
    const errByKey = parseSubject(
      "const err = (input: { err?: Error }) => input.err;",
    );
    const errByFalse = parseSubject(
      "const err = () => ({ ok: false as const });",
    );
    const errorByKey = parseSubject(
      "const error = (input: { error?: Error }) => input.error;",
    );

    expect(findManualResultMatch(errByKey)?.displayName).toBe("err");
    expect(findManualResultMatch(errByFalse)?.displayName).toBe("err");
    expect(findManualResultMatch(errorByKey)?.displayName).toBe("error");
  });

  it("recognizes the extended result helper names", () => {
    const cases = [
      [
        "error",
        "const error = <E>(error: E) => ({ ok: false as const, error });",
      ],
      [
        "left",
        'const left = <L>(left: L) => ({ _tag: "Left" as const, left });',
      ],
      [
        "right",
        'const right = <R>(right: R) => ({ _tag: "Right" as const, right });',
      ],
      [
        "success",
        'const success = <T>(success: T) => ({ _tag: "Success" as const, success });',
      ],
      [
        "failure",
        "const failure = <E>(failure: E) => ({ failure });",
      ],
      [
        "isOk",
        "const isOk = (input: { ok: boolean }) => input.ok;",
      ],
      [
        "isErr",
        "const isErr = (input: { error?: Error }) => input.error;",
      ],
      [
        "isLeft",
        'const isLeft = (input: { _tag: "Left" | "Right" }) => input._tag === "Left";',
      ],
      [
        "isRight",
        'const isRight = (input: { _tag: "Left" | "Right" }) => input._tag === "Right";',
      ],
      [
        "isSuccess",
        "const isSuccess = (input: { success?: number }) => input.success;",
      ],
      [
        "isFailure",
        "const isFailure = (input: { failure?: Error }) => input.failure;",
      ],
    ] as const;

    for (const [expectedName, code] of cases) {
      expect(findManualResultMatch(parseSubject(code))?.displayName).toBe(expectedName);
    }
  });

  it("keeps result helper names clean when their evidence does not match", () => {
    const cases = [
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

    for (const code of cases) {
      expect(findManualResultMatch(parseSubject(code))).toBeNull();
    }
  });

  it("keeps reusable result helpers clean when only unrelated branch evidence is present", () => {
    const match = parseSubject(
      "const match = (input: { tch?: string }) => input.tch;",
    );
    const outcome = parseSubject(
      "function Outcome(input: { tcome?: string }) { return input.tcome; }",
    );

    expect(findManualResultMatch(match)).toBeNull();
    expect(findManualResultMatch(outcome)).toBeNull();
  });

  it("requires complete left/right evidence pairs on neutral result-like surfaces", () => {
    const leftOnly = parseSubject(
      "type helpers = { readonly left: string };",
    );
    const rightOnly = parseSubject(
      "type helpers = { readonly right: string };",
    );

    expect(findManualResultMatch(leftOnly)).toBeNull();
    expect(findManualResultMatch(rightOnly)).toBeNull();
  });

  it("requires complete ok-based evidence on result-like surfaces", () => {
    const okOnly = parseSubject(
      "type Outcome = { readonly ok: true };",
    );
    const issueOnly = parseSubject(
      "type Outcome = { readonly ok: true; readonly issue: string };",
    );
    const withError = parseSubject(
      "type Outcome = { readonly ok: true; readonly error: string };",
    );
    const withErr = parseSubject(
      "type Outcome = { readonly ok: true; readonly err: string };",
    );
    const withValue = parseSubject(
      "type Outcome = { readonly ok: true; readonly value: string };",
    );

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
    const present = parseSubject(
      'const present = <T>(value: T) => ({ _tag: "Present" as const, value });',
    );
    const absent = parseSubject(
      'const absent = () => ({ _tag: "Absent" as const });',
    );
    const hasValue = parseSubject(
      "const hasValue = (option: { value?: number }) => option.value;",
    );
    const isNone = parseSubject(
      'const isNone = (option: { _tag: "None" | "Some" }) => option._tag === "None";',
    );

    expect(findManualOptionMatch(present)?.displayName).toBe("present");
    expect(findManualOptionMatch(absent)?.displayName).toBe("absent");
    expect(findManualOptionMatch(hasValue)?.displayName).toBe("hasValue");
    expect(findManualOptionMatch(isNone)?.displayName).toBe("isNone");
  });

  it("keeps helper-like option names clean when the evidence does not match", () => {
    const present = parseSubject(
      'const present = () => ({ _tag: "Missing" as const });',
    );
    const absent = parseSubject(
      'const absent = () => ({ _tag: "Missing" as const });',
    );
    const hasValue = parseSubject(
      "const hasValue = (option: { current?: number }) => option.current;",
    );
    const isNone = parseSubject(
      'const isNone = (option: { _tag: "Some" }) => option._tag === "Some";',
    );

    expect(findManualOptionMatch(present)).toBeNull();
    expect(findManualOptionMatch(absent)).toBeNull();
    expect(findManualOptionMatch(hasValue)).toBeNull();
    expect(findManualOptionMatch(isNone)).toBeNull();
  });

  it("recognizes the base option helper names", () => {
    const some = parseSubject(
      'const some = <T>(value: T) => ({ _tag: "Some" as const, value });',
    );
    const none = parseSubject(
      'const none = () => ({ _tag: "None" as const });',
    );
    const isSome = parseSubject(
      "const isSome = (option: { value?: number }) => option.value;",
    );

    expect(findManualOptionMatch(some)?.displayName).toBe("some");
    expect(findManualOptionMatch(none)?.displayName).toBe("none");
    expect(findManualOptionMatch(isSome)?.displayName).toBe("isSome");
  });

  it("keeps the base option helper names clean when evidence does not match", () => {
    const some = parseSubject(
      'const some = () => ({ _tag: "Missing" as const });',
    );
    const none = parseSubject(
      'const none = () => ({ _tag: "Missing" as const });',
    );
    const isSome = parseSubject(
      "const isSome = (option: { current?: number }) => option.current;",
    );

    expect(findManualOptionMatch(some)).toBeNull();
    expect(findManualOptionMatch(none)).toBeNull();
    expect(findManualOptionMatch(isSome)).toBeNull();
  });

  it("still flags non-function option surfaces that rely on branch pairs", () => {
    const typeAlias = parseSubject(
      "type Some<T> = { readonly some: T; readonly none: null };",
    );

    expect(findManualOptionMatch(typeAlias)?.displayName).toBe("Some");
  });

  it("keeps reusable option helpers clean when only `None` evidence is present", () => {
    const option = parseSubject(
      'const Option = () => ({ _tag: "None" as const });',
    );
    const match = parseSubject(
      'const match = () => ({ _tag: "None" as const });',
    );

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
    const optionClass = parseSubject(
      "class Option { some() { return 1; } none() { return null; } }",
    );
    const brandType = parseSubject(
      'type UserId = string & { readonly __brand: "UserId" };',
    );

    expect(findManualResultMatch(resultType)?.displayName).toBe("Result");
    expect(findManualResultMatch(resultInterface)?.displayName).toBe("Result");
    expect(findManualOptionMatch(optionClass)?.displayName).toBe("Option");
    expect(findManualBrandMatch(brandType)?.displayName).toBe("UserId");
  });

  it("keeps unsupported type, class, and declarator surfaces clean", () => {
    const scalarType = parseSubject("type Result = number;");
    const indexInterface = parseSubject(
      "interface Result { [key: string]: unknown; }",
    );
    const classWithStaticBlock = parseSubject(
      "class Result { static { void 0; } }",
    );
    const callInitializer = parseSubject("const Result = makeResult();");
    const destructured = parseSubject("const { Result } = helpers;");

    expect(findManualResultMatch(scalarType)).toBeNull();
    expect(findManualResultMatch(indexInterface)).toBeNull();
    expect(findManualResultMatch(classWithStaticBlock)).toBeNull();
    expect(findManualResultMatch(callInitializer)).toBeNull();
    expect(findManualResultMatch(destructured)).toBeNull();
  });

  it("uses method signatures as reusable signals when properties are absent", () => {
    const resultInterface = parseSubject(
      "interface helpers { left(): string; right(): string; match(): unknown; }",
    );
    const optionInterface = parseSubject(
      "interface helpers { some(): number; none(): null; flatMap(): unknown; }",
    );

    expect(findManualResultMatch(resultInterface)?.displayName).toBe("helpers");
    expect(findManualOptionMatch(optionInterface)?.displayName).toBe("helpers");
  });

  it("keeps non-identifier cast targets out of brand helper detection", () => {
    const namespaced = parseSubject(
      "const asUserId = (value: string): user.UserId => value as user.UserId;",
    );
    const literal = parseSubject(
      'const asUserId = (value: string): "UserId" => value as "UserId";',
    );

    expect(findManualBrandMatch(namespaced)).toBeNull();
    expect(findManualBrandMatch(literal)).toBeNull();
  });

  it("requires explicit return types on variable helper casts", () => {
    const missingReturnType = parseSubject(
      "const asUserId = (value: string) => value as UserId;",
    );

    expect(findManualBrandMatch(missingReturnType)).toBeNull();
  });

  it("keeps multi-statement and empty-return brand helpers clean", () => {
    const multiStatement = parseSubject(
      "function asUserId(value: string): UserId { return value as UserId; console.log(value); }",
    );
    const emptyReturn = parseSubject(
      "function asUserId(value: string): UserId { return; }",
    );

    expect(findManualBrandMatch(multiStatement)).toBeNull();
    expect(findManualBrandMatch(emptyReturn)).toBeNull();
  });

  it("exempts option-like tagged errors that would otherwise match", () => {
    const node = parseSubject(
      'type OptionFailure<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };',
    );

    expect(isTaggedErrorCollision(node)).toBe(true);
    expect(findManualOptionMatch(node)).toBeNull();
  });
});
