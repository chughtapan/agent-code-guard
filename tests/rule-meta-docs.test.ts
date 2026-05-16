/**
 * @file Asserts that every plugin rule carries `meta.docs.description`
 * (a one-line rationale) and `meta.docs.url` whose fragment is a real
 * heading in safer-by-default's `PRINCIPLES.md`.
 *
 * The valid-anchor set is mirrored as a static fixture so the test stays
 * correct offline. The fixture is the second source of truth: rule URLs
 * (which use the `PRINCIPLE_URL` constants) and this set are independent,
 * and the test fires when they drift.
 */

import { describe, expect, it } from "vitest";
import plugin from "../src/index.js";
import { SAFER_PRINCIPLES_URL } from "../src/rules/utils/principles.js";

const URL_PREFIX = `${SAFER_PRINCIPLES_URL}#`;

const PRINCIPLES_MD_HEADING_SLUGS: ReadonlySet<string> = new Set([
  "you-are-the-new-compiler",
  "the-debt-multiplier",
  "1-types-beat-tests--move-constraints-into-the-type-system",
  "2-validate-at-every-boundary--schemas-where-data-enters-types-inside",
  "3-errors-are-typed-not-thrown--tagged-errors-or-typed-results-no-raw-throws-no-silent-catches",
  "4-exhaustiveness-over-optionality--every-branch-handled-switches-end-in-never",
  "5-discipline-over-capability",
  "6-the-budget-gate--scope-is-a-hard-budget",
  "7-the-brake--stop-rules-are-literal",
  "8-the-ratchet--escalate-up-not-around",
  "the-budget",
  "independence",
  "floor-and-ceiling",
  "anti-patterns",
  "contracts",
  "durable-records",
  "every-output-carries-receipts",
  "write-for-the-cold-start-reader",
  "phrases-to-reject",
]);

describe("plugin rule meta.docs", () => {
  const ruleEntries = Object.entries(plugin.rules);

  it.each(ruleEntries)("%s carries a non-empty description", (_name, rule) => {
    const description = rule.meta.docs?.description;
    expect(typeof description).toBe("string");
    expect((description ?? "").trim().length).toBeGreaterThan(0);
  });

  it.each(ruleEntries)(
    "%s url points at PRINCIPLES.md with a known fragment",
    (_name, rule) => {
      const url = rule.meta.docs?.url ?? "";
      expect(url.startsWith(URL_PREFIX)).toBe(true);
      const fragment = url.slice(URL_PREFIX.length);
      expect(PRINCIPLES_MD_HEADING_SLUGS.has(fragment)).toBe(true);
    },
  );
});
