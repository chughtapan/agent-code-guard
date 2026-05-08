import * as fc from "fast-check";
import { expect, it } from "vitest";
import {
  lintAll,
  messageDetails,
  mutate,
  paddingArb,
  renameArb,
  safeSourceArb,
  seedIdent,
  SEEDS,
  isSyntacticallyValid,
  type RuleSeed,
} from "./test-support/rule-correctness-fixtures.js";

it("Property 1: no recommended rule fires on safe TS sources", () => {
  expect.hasAssertions();
  fc.assert(
    fc.property(safeSourceArb, (code) => {
      if (!isSyntacticallyValid(code)) return;
      const messages = lintAll(code);
      expect(
        messages,
        `Safe source produced reports:\n--- source ---\n${code}\n--- reports ---\n${messageDetails(messages)}`,
      ).toHaveLength(0);
    }),
    { numRuns: 200 },
  );
});

for (const seed of SEEDS) {
  it(`Property 2: ${seed.ruleId} fires on its anti-pattern across mutations`, () => {
    expect.hasAssertions();
    fc.assert(
      fc.property(paddingArb, renameArb, (pad, rename) => {
        assertSeedMutation(seed, pad, rename);
      }),
      { numRuns: 20 },
    );
  });
}

function assertSeedMutation(seed: RuleSeed, pad: string, rename: string): void {
  const code = mutate(seed.seed, pad, seedIdent(seed.ruleId), rename);
  if (!isSyntacticallyValid(code)) return;
  const allMessages = lintAll(code, seed.filename);
  const firedIds = firedRuleIds(allMessages);
  const ownFired = firedIds.has(seed.ruleId);
  const unexpected = [...firedIds].filter(
    (id) => id !== seed.ruleId && !seed.coFire.includes(id),
  );

  expect(
    { ownFired, unexpected },
    seedFailureMessage({ ruleId: seed.ruleId, code, allMessages, ownFired, unexpected }),
  ).toEqual({ ownFired: true, unexpected: [] });
}

function firedRuleIds(messages: readonly { readonly ruleId: string | null }[]): ReadonlySet<string> {
  return new Set(
    messages
      .map((message) => message.ruleId)
      .filter((ruleId): ruleId is string => ruleId !== null),
  );
}

interface SeedFailureInput {
  readonly ruleId: string;
  readonly code: string;
  readonly allMessages: Parameters<typeof messageDetails>[0];
  readonly ownFired: boolean;
  readonly unexpected: readonly string[];
}

function seedFailureMessage(input: SeedFailureInput): string {
  return (
    `Mutation broke expectations for ${input.ruleId}:\n` +
    `--- source ---\n${input.code}\n` +
    `--- own fired: ${input.ownFired} ---\n` +
    `--- unexpected: ${input.unexpected.join(", ") || "(none)"} ---\n` +
    `--- all reports ---\n${messageDetails(input.allMessages)}`
  );
}
