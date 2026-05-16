/**
 * @file Asserts that every plugin rule carries `meta.docs.description`
 * (one-line rationale) and `meta.docs.url` (anchored at a real heading
 * in safer-by-default's `PRINCIPLES.md`).
 *
 * The valid-anchor set is mirrored as a static fixture below so the test
 * stays correct offline; CI does not need network access to validate.
 * When `PRINCIPLES.md` adds or removes a `## ` heading, update
 * `PRINCIPLES_MD_HEADING_SLUGS` to match.
 */

import { describe, expect, it } from "vitest";
import plugin from "../src/index.js";

const PRINCIPLES_URL_PREFIX =
  "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#";

// GitHub-anchor slugs for every `## ` heading in safer-by-default's
// PRINCIPLES.md as of the post-Phase-5 4-part restructure. Derivation:
// take the heading text, lowercase, replace whitespace with hyphens,
// strip everything that is not [a-z0-9_-]. Markdown italic / inline-code
// marks render to plain text in HTML, so they're stripped before the
// hyphen substitution.
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

interface MetaDocs {
  readonly description?: unknown;
  readonly url?: unknown;
}

function metaDocs(rule: unknown): MetaDocs {
  if (typeof rule !== "object" || rule === null) {
    throw new TypeError("rule is not an object");
  }
  const meta = (rule as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null) {
    throw new TypeError("rule.meta is not an object");
  }
  const docs = (meta as { docs?: unknown }).docs;
  if (typeof docs !== "object" || docs === null) {
    throw new TypeError("rule.meta.docs is not an object");
  }
  return docs as MetaDocs;
}

describe("plugin rule meta.docs", () => {
  const ruleEntries = Object.entries(plugin.rules);

  it("registers at least one rule (sanity)", () => {
    expect(ruleEntries.length).toBeGreaterThan(0);
  });

  it.each(ruleEntries)(
    "%s carries a non-empty description",
    (_name, rule) => {
      const docs = metaDocs(rule);
      expect(typeof docs.description).toBe("string");
      expect((docs.description as string).trim().length).toBeGreaterThan(0);
    },
  );

  it.each(ruleEntries)(
    "%s url points at PRINCIPLES.md with a known fragment",
    (_name, rule) => {
      const docs = metaDocs(rule);
      expect(typeof docs.url).toBe("string");
      const url = docs.url as string;
      expect(url.startsWith(PRINCIPLES_URL_PREFIX)).toBe(true);
      const fragment = url.slice(PRINCIPLES_URL_PREFIX.length);
      expect(fragment.length).toBeGreaterThan(0);
      expect(PRINCIPLES_MD_HEADING_SLUGS.has(fragment)).toBe(true);
    },
  );
});
