import * as fc from "fast-check";
import { expect, it } from "vitest";
import { findManualBrandMatch } from "./manual-algebra-detection.js";
import { findManualBrandConstructorMatch } from "./manual-algebra-brand-helper.js";
import { parseSubject } from "./test-support/manual-algebra-detection-fixtures.js";

const brandNameArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);
const brandPrefixArb = fc.constantFrom("", "as", "make", "to");

it("requires brand helper names before flagging a cast helper constructor", () => {
  const neutral = parseSubject("const project = (value: string): UserId => value as UserId;");
  const branded = parseSubject("const asUserId = (value: string): UserId => value as UserId;");

  expect(findManualBrandConstructorMatch(neutral)).toBeNull();
  expect(findManualBrandConstructorMatch(branded)?.displayName).toBe("asUserId");
});

it("requires a real brand marker before treating plain literals as brands", () => {
  const node = parseSubject('type AgentName = { readonly label: "AgentName" };');

  expect(findManualBrandMatch(node)).toBeNull();
});

it("detects cast helper constructors without an explicit return type", () => {
  const missingReturnType = parseSubject("function asUserId(value: string) { return value as UserId; }");

  expect(findManualBrandConstructorMatch(missingReturnType)?.displayName).toBe("asUserId");
});

it("does not flag indirect brand helper constructors", () => {
  const indirectReturn = parseSubject(
    "function asUserId(value: string): UserId { const next = value as UserId; return next; }",
  );

  expect(findManualBrandConstructorMatch(indirectReturn)).toBeNull();
});

it("accepts all supported brand helper prefixes", () => {
  const directHelper = parseSubject("const UserId = (value: string): UserId => value as UserId;");
  const makeHelper = parseSubject("const makeUserId = (value: string): UserId => value as UserId;");
  const toHelper = parseSubject("const toUserId = (value: string): UserId => value as UserId;");
  const functionExpression = parseSubject(
    "const asUserId = function (value: string): UserId { return value as UserId; };",
  );

  expect(findManualBrandConstructorMatch(directHelper)?.displayName).toBe("UserId");
  expect(findManualBrandConstructorMatch(makeHelper)?.displayName).toBe("makeUserId");
  expect(findManualBrandConstructorMatch(toHelper)?.displayName).toBe("toUserId");
  expect(findManualBrandConstructorMatch(functionExpression)?.displayName).toBe("asUserId");
});

it("keeps non-identifier cast targets out of brand helper detection", () => {
  const namespaced = parseSubject(
    "const asUserId = (value: string): user.UserId => value as user.UserId;",
  );
  const literal = parseSubject('const asUserId = (value: string): "UserId" => value as "UserId";');

  expect(findManualBrandConstructorMatch(namespaced)).toBeNull();
  expect(findManualBrandConstructorMatch(literal)).toBeNull();
});

it("detects variable helper casts without explicit return types", () => {
  const missingReturnType = parseSubject("const asUserId = (value: string) => value as UserId;");

  expect(findManualBrandConstructorMatch(missingReturnType)?.displayName).toBe("asUserId");
});

it("keeps multi-statement and empty-return brand helpers clean", () => {
  const multiStatement = parseSubject(
    "function asUserId(value: string): UserId { return value as UserId; console.log(value); }",
  );
  const emptyReturn = parseSubject("function asUserId(value: string): UserId { return; }");

  expect(findManualBrandConstructorMatch(multiStatement)).toBeNull();
  expect(findManualBrandConstructorMatch(emptyReturn)).toBeNull();
});

it("Property: brand constructor detection follows helper naming and direct casts", () => {
  fc.assert(
    fc.property(brandNameArb, brandPrefixArb, (brandName, prefix) => {
      const helperName = prefix === "" ? brandName : `${prefix}${brandName}`;
      const helper = parseSubject(brandCastHelper(helperName, brandName));
      const neutral = parseSubject(brandCastHelper(`project${brandName}`, brandName));

      expect(findManualBrandConstructorMatch(helper)?.displayName).toBe(helperName);
      expect(findManualBrandConstructorMatch(neutral)).toBeNull();
    }),
    { numRuns: 60 },
  );
});

function brandCastHelper(helperName: string, brandName: string): string {
  return `const ${helperName} = (value: string): ${brandName} => value as ${brandName};`;
}
