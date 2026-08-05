/**
 * @file Proves with an executed before/after module graph that sorting a
 * consumer's imports cannot reorder the evaluation of a runtime ESM cycle the
 * consumer reaches through a single door.
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  pureBindingModule,
  runModuleGraph,
  sortLikeMigration,
  stableShellFindings,
} from "./test-support/import-evaluation-order.js";

const DOOR_MODULE = [
  "/**",
  " * @file Cycle door: the only member consumers import, and the entry the cycle is evaluated from.",
  " */",
  "",
  'import { hubLabel } from "./cycle-hub.mjs";',
  'import { record } from "./recorder.mjs";',
  "",
  'export const doorName = "door";',
  "",
  'record("evaluated cycle-door");',
  "",
  "export function doorLabel() {",
  "  return `${doorName}>${hubLabel()}`;",
  "}",
  "",
].join("\n");

const HUB_MODULE = [
  "/**",
  " * @file Cycle hub: middle member of the runtime cycle, reachable only through the door.",
  " */",
  "",
  'import { leafLabel } from "./cycle-leaf.mjs";',
  'import { record } from "./recorder.mjs";',
  "",
  'record("evaluated cycle-hub");',
  "",
  "export function hubLabel() {",
  "  return `hub>${leafLabel()}`;",
  "}",
  "",
].join("\n");

const LEAF_MODULE = [
  "/**",
  " * @file Cycle leaf: closes the runtime cycle back onto the door's binding.",
  " */",
  "",
  'import { doorName } from "./cycle-door.mjs";',
  'import { record } from "./recorder.mjs";',
  "",
  'record("evaluated cycle-leaf");',
  "",
  "export function leafLabel() {",
  "  return `leaf@${doorName}`;",
  "}",
  "",
].join("\n");

const DEPENDENT_MODULE = [
  "/**",
  " * @file Cycle dependent: records its own evaluation and reaches the cycle only through the door.",
  " */",
  "",
  'import { doorLabel } from "./cycle-door.mjs";',
  'import { record } from "./recorder.mjs";',
  "",
  'record("evaluated cycle-dependent");',
  "",
  "export function dependentLabel() {",
  "  return `dependent>${doorLabel()}`;",
  "}",
  "",
].join("\n");

const SORTED_IMPORTS = [
  'import { dependentLabel } from "./cycle-dependent.mjs";',
  'import { doorLabel } from "./cycle-door.mjs";',
  'import { alphaValue } from "./pure-alpha.mjs";',
  'import { zuluValue } from "./pure-zulu.mjs";',
];

const PRE_MIGRATION_IMPORTS = [
  SORTED_IMPORTS[3],
  SORTED_IMPORTS[1],
  SORTED_IMPORTS[0],
  SORTED_IMPORTS[2],
];

const EXPECTED_TRACE = [
  "evaluated cycle-leaf",
  "evaluated cycle-hub",
  "evaluated cycle-door",
  "evaluated cycle-dependent",
  "result door>hub>leaf@door dependent>door>hub>leaf@door alpha zulu",
];

function consumerWith(imports: readonly string[]): string {
  return [
    "/**",
    " * @file Cycle consumer whose import order the migration's sorting phase rewrites.",
    " */",
    "",
    ...imports,
    "",
    'export const consumerResult = [doorLabel(), dependentLabel(), alphaValue, zuluValue].join(" ");',
    "",
  ].join("\n");
}

function cycleGraph(consumer: string): Readonly<Record<string, string>> {
  return {
    "consumer.mjs": consumer,
    "cycle-dependent.mjs": DEPENDENT_MODULE,
    "cycle-door.mjs": DOOR_MODULE,
    "cycle-hub.mjs": HUB_MODULE,
    "cycle-leaf.mjs": LEAF_MODULE,
    "pure-alpha.mjs": pureBindingModule("alphaValue", "alpha"),
    "pure-zulu.mjs": pureBindingModule("zuluValue", "zulu"),
  };
}

describe("vertical-organization ESM-cycle import-evaluation fixture", () => {
  it("passes the stable-shell guard that gates the sorting phase", () => {
    expect(stableShellFindings(consumerWith(PRE_MIGRATION_IMPORTS))).toEqual([]);
  });

  it("reorders two cycle-touching imports when the migration sorts the consumer", () => {
    const before = consumerWith(PRE_MIGRATION_IMPORTS);

    expect(sortLikeMigration(before)).toBe(consumerWith(SORTED_IMPORTS));
    expect(sortLikeMigration(before)).not.toBe(before);
  });

  it("evaluates the cycle in the same order before and after the sort", () => {
    const before = runModuleGraph(cycleGraph(consumerWith(PRE_MIGRATION_IMPORTS)));
    const after = runModuleGraph(cycleGraph(consumerWith(SORTED_IMPORTS)));

    expect(before).toEqual(EXPECTED_TRACE);
    expect(after).toEqual(before);
  });

  it("evaluates the cycle identically under every consumer import order", () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(SORTED_IMPORTS, { minLength: SORTED_IMPORTS.length }),
        (imports) => {
          expect(runModuleGraph(cycleGraph(consumerWith(imports)))).toEqual(EXPECTED_TRACE);
        },
      ),
      { numRuns: 8 },
    );
  });
});
