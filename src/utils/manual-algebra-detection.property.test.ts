import * as fc from "fast-check";
import { expect, it } from "vitest";
import {
  findManualOptionMatch,
  findManualResultMatch,
  isTaggedErrorCollision,
  isTransportDataShape,
} from "./manual-algebra-detection.js";
import { findManualBrandConstructorMatch } from "./manual-algebra-brand-helper.js";
import { parseSubject } from "./test-support/manual-algebra-detection-fixtures.js";

const typeNameArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);
const suffixArb = fc.constantFrom("Response", "Payload", "State", "Config");
const resultHelperArb = fc.constantFrom(
  "ok",
  "err",
  "error",
  "left",
  "right",
  "success",
  "failure",
);
const optionHelperArb = fc.constantFrom("some", "none", "present", "absent");
const brandPrefixArb = fc.constantFrom("", "as", "make", "to");
const errorSuffixArb = fc.constantFrom("Error", "Failure", "Failed", "Exception");

it("Property: transport-shaped result aliases remain clean across transport names", () => {
  fc.assert(
    fc.property(typeNameArb, suffixArb, (name, suffix) => {
      const node = parseSubject(resultTransportAlias(`${name}${suffix}`));

      expect(isTransportDataShape(node)).toBe(true);
      expect(findManualResultMatch(node)).toBeNull();
    }),
    { numRuns: 80 },
  );
});

it("Property: result helper names fire only when their evidence matches", () => {
  fc.assert(
    fc.property(resultHelperArb, (helperName) => {
      expect(findManualResultMatch(parseSubject(resultHelperSource(helperName)))?.displayName)
        .toBe(helperName);
      expect(findManualResultMatch(parseSubject(mismatchedResultHelperSource(helperName))))
        .toBeNull();
    }),
    { numRuns: 80 },
  );
});

it("Property: neutral result surfaces need complete branch-pair evidence", () => {
  fc.assert(
    fc.property(typeNameArb, fc.constantFrom("left", "right", "ok"), (name, key) => {
      const node = parseSubject(`type ${name} = { readonly ${key}: string };`);

      expect(findManualResultMatch(node)).toBeNull();
    }),
    { numRuns: 80 },
  );
});

it("Property: option helper names fire only when their evidence matches", () => {
  fc.assert(
    fc.property(optionHelperArb, (helperName) => {
      expect(findManualOptionMatch(parseSubject(optionHelperSource(helperName)))?.displayName)
        .toBe(helperName);
      expect(findManualOptionMatch(parseSubject(mismatchedOptionHelperSource(helperName))))
        .toBeNull();
    }),
    { numRuns: 80 },
  );
});

it("Property: tagged errors stay out of manual result and option detection", () => {
  fc.assert(
    fc.property(typeNameArb, errorSuffixArb, (name, suffix) => {
      const node = parseSubject(taggedOptionErrorAlias(`${name}${suffix}`));

      expect(isTaggedErrorCollision(node)).toBe(true);
      expect(findManualOptionMatch(node)).toBeNull();
      expect(findManualResultMatch(node)).toBeNull();
    }),
    { numRuns: 80 },
  );
});

it("Property: brand constructor detection requires helper naming plus a direct cast", () => {
  fc.assert(
    fc.property(typeNameArb, brandPrefixArb, (brandName, prefix) => {
      const helperName = brandHelperName(brandName, prefix);
      const node = parseSubject(brandCastHelper(helperName, brandName));
      const neutral = parseSubject(brandCastHelper(`project${brandName}`, brandName));

      expect(findManualBrandConstructorMatch(node)?.displayName).toBe(helperName);
      expect(findManualBrandConstructorMatch(neutral)).toBeNull();
    }),
    { numRuns: 80 },
  );
});

function resultTransportAlias(name: string): string {
  return `type ${name}<T, E> = ` +
    "{ readonly ok: true; readonly value: T } | " +
    "{ readonly ok: false; readonly error: E };";
}

function resultHelperSource(helperName: string): string {
  return RESULT_HELPER_SOURCES[helperName] ?? "const ok = () => ({ ok: true as const, value: 1 });";
}

function mismatchedResultHelperSource(helperName: string): string {
  return `const ${helperName} = () => ({ _tag: "Missing" as const });`;
}

function optionHelperSource(helperName: string): string {
  return OPTION_HELPER_SOURCES[helperName] ?? 'const some = () => ({ _tag: "Some" as const });';
}

function mismatchedOptionHelperSource(helperName: string): string {
  return `const ${helperName} = () => ({ _tag: "Missing" as const });`;
}

function taggedOptionErrorAlias(name: string): string {
  return `type ${name}<T> = ` +
    '{ readonly _tag: "Some"; readonly value: T } | ' +
    '{ readonly _tag: "None" };';
}

function brandHelperName(brandName: string, prefix: string): string {
  return prefix === "" ? brandName : `${prefix}${brandName}`;
}

function brandCastHelper(helperName: string, brandName: string): string {
  return `const ${helperName} = (value: string): ${brandName} => value as ${brandName};`;
}

const RESULT_HELPER_SOURCES: Record<string, string> = {
  ok: "const ok = (value: number) => ({ ok: true as const, value });",
  err: "const err = (error: Error) => ({ ok: false as const, error });",
  error: "const error = (error: Error) => ({ ok: false as const, error });",
  left: 'const left = (left: string) => ({ _tag: "Left" as const, left });',
  right: 'const right = (right: string) => ({ _tag: "Right" as const, right });',
  success: 'const success = (success: string) => ({ _tag: "Success" as const, success });',
  failure: "const failure = (failure: Error) => ({ failure });",
};

const OPTION_HELPER_SOURCES: Record<string, string> = {
  some: 'const some = (value: number) => ({ _tag: "Some" as const, value });',
  none: 'const none = () => ({ _tag: "None" as const });',
  present: 'const present = (value: number) => ({ _tag: "Present" as const, value });',
  absent: 'const absent = () => ({ _tag: "Absent" as const });',
};
