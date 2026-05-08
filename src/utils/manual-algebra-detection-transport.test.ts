import * as fc from "fast-check";
import { expect, it } from "vitest";
import {
  findManualBrandMatch,
  findManualOptionMatch,
  findManualResultMatch,
  isTaggedErrorCollision,
  isTransportDataShape,
} from "./manual-algebra-detection.js";
import { parseSubject } from "./test-support/manual-algebra-detection-fixtures.js";

const typeNameArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);
const transportSuffixArb = fc.constantFrom("Response", "Payload", "State", "Config");
const discriminantKeyArb = fc.constantFrom("status", "type", "kind");

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
  const node = parseSubject("type OptionState<T> = { readonly some: T; readonly none: null };");

  expect(isTransportDataShape(node)).toBe(true);
  expect(findManualOptionMatch(node)).toBeNull();
});

it("exempts transport-shaped brand aliases that would otherwise look manual", () => {
  const node = parseSubject('type UserIdPayload = string & { readonly __brand: "UserIdPayload" };');

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
  const node = parseSubject('type ParseFailure = { readonly label: "ParseFailure"; readonly message: string };');

  expect(isTaggedErrorCollision(node)).toBe(false);
});

it("still flags result-like surfaces when error-like literals are not on `_tag`", () => {
  const node = parseSubject(
    'type Outcome<T, E> = { readonly status: "OperationFailure"; readonly ok: true; readonly value: T } | { readonly status: "Ready"; readonly ok: false; readonly error: E };',
  );

  expect(isTaggedErrorCollision(node)).toBe(false);
  expect(findManualResultMatch(node)?.displayName).toBe("Outcome");
});

it("Property: transport-shaped result aliases remain clean across transport names", () => {
  fc.assert(
    fc.property(typeNameArb, transportSuffixArb, (name, suffix) => {
      const node = parseSubject(resultTransportAlias(`${name}${suffix}`));

      expect(isTransportDataShape(node)).toBe(true);
      expect(findManualResultMatch(node)).toBeNull();
    }),
    { numRuns: 60 },
  );
});

it("Property: neutral discriminant unions stay transport/data shapes", () => {
  fc.assert(
    fc.property(typeNameArb, discriminantKeyArb, (name, discriminantKey) => {
      const node = parseSubject(discriminantUnion(name, discriminantKey));

      expect(isTransportDataShape(node)).toBe(true);
      expect(findManualOptionMatch(node)).toBeNull();
      expect(findManualResultMatch(node)).toBeNull();
    }),
    { numRuns: 60 },
  );
});

function resultTransportAlias(name: string): string {
  return `type ${name}<T, E> = ` +
    "{ readonly ok: true; readonly value: T } | " +
    "{ readonly ok: false; readonly error: E };";
}

function discriminantUnion(name: string, discriminantKey: string): string {
  return `type ${name} = ` +
    `{ readonly ${discriminantKey}: "Loading" } | ` +
    `{ readonly ${discriminantKey}: "Loaded"; readonly value: string };`;
}
