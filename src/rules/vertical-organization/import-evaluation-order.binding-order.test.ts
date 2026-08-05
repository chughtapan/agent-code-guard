/**
 * @file Proves with an executed before/after module graph that a paired
 * side-effect-import barrier is a hard partition no ordinary import or
 * source-bearing re-export can cross once the stable-shell guard is clean.
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  pureBindingModule,
  runModuleGraph,
  sortLikeMigration,
  stableShellFindings,
} from "./test-support/import-evaluation-order.js";

const BARRIER_REASON =
  "registration publishes the registry token every observer module reads while it evaluates";
const BEGIN_BARRIER = `// agent-code-guard: side-effect-import-begin -- evaluation-order: ${BARRIER_REASON}`;
const END_BARRIER = `// agent-code-guard: side-effect-import-end -- evaluation-order: ${BARRIER_REASON}`;
const CHARLIE_REEXPORT = 'export { charlieObservation } from "./charlie-observer.mjs";';

const REGISTRY_MODULE = [
  "/**",
  " * @file Mutable registry the registration side effect publishes into.",
  " */",
  "",
  'export const registry = { token: "unregistered" };',
  "",
].join("\n");

const REGISTRATION_MODULE = [
  "/**",
  " * @file Bare side-effect module: publishes the registry token observers read while they evaluate.",
  " */",
  "",
  'import { record } from "./recorder.mjs";',
  'import { registry } from "./registry.mjs";',
  "",
  'registry.token = "registered";',
  'record("evaluated registration");',
  "",
].join("\n");

const ABOVE_BARRIER_IMPORTS = [
  'import { yankeeConstant } from "./yankee-constant.mjs";',
  'import { zuluConstant } from "./zulu-constant.mjs";',
];

const BELOW_BARRIER_IMPORTS = [
  'import { alphaConstant } from "./alpha-constant.mjs";',
  'import { bravoObservation } from "./bravo-observer.mjs";',
];

const REEXPORTS = ['export { betaConstant } from "./beta-constant.mjs";', CHARLIE_REEXPORT];

const EXPECTED_TRACE = [
  "evaluated registration",
  "observed bravo-observer token=registered",
  "observed charlie-observer token=registered",
  "result alpha registered yankee zulu",
];

interface ConsumerShape {
  readonly above: readonly string[];
  readonly below: readonly string[];
  readonly reexports: readonly string[];
}

const SORTED_SHAPE: ConsumerShape = {
  above: ABOVE_BARRIER_IMPORTS,
  below: BELOW_BARRIER_IMPORTS,
  reexports: REEXPORTS,
};

const PRE_MIGRATION_SHAPE: ConsumerShape = {
  above: [...ABOVE_BARRIER_IMPORTS].reverse(),
  below: [...BELOW_BARRIER_IMPORTS].reverse(),
  reexports: [...REEXPORTS].reverse(),
};

function consumerWith(shape: ConsumerShape): string {
  return [
    "/**",
    " * @file Binding-order consumer whose import order the migration's sorting phase rewrites.",
    " */",
    "",
    ...shape.above,
    BEGIN_BARRIER,
    'import "./registration.mjs";',
    END_BARRIER,
    ...shape.below,
    "",
    ...shape.reexports,
    "",
    'export const consumerResult = [alphaConstant, bravoObservation, yankeeConstant, zuluConstant].join(" ");',
    "",
  ].join("\n");
}

function bindingGraph(consumer: string): Readonly<Record<string, string>> {
  return {
    "alpha-constant.mjs": pureBindingModule("alphaConstant", "alpha"),
    "beta-constant.mjs": pureBindingModule("betaConstant", "beta"),
    "bravo-observer.mjs": observerModule("bravo-observer", "bravoObservation"),
    "charlie-observer.mjs": observerModule("charlie-observer", "charlieObservation"),
    "consumer.mjs": consumer,
    "registration.mjs": REGISTRATION_MODULE,
    "registry.mjs": REGISTRY_MODULE,
    "yankee-constant.mjs": pureBindingModule("yankeeConstant", "yankee"),
    "zulu-constant.mjs": pureBindingModule("zuluConstant", "zulu"),
  };
}

function observerModule(name: string, binding: string): string {
  return [
    "/**",
    " * @file Observer that reads the registry token at its own evaluation time.",
    " */",
    "",
    'import { record } from "./recorder.mjs";',
    'import { registry } from "./registry.mjs";',
    "",
    `export const ${binding} = registry.token;`,
    "",
    `record(\`observed ${name} token=\${${binding}}\`);`,
    "",
  ].join("\n");
}

describe("vertical-organization binding-import-order fixture", () => {
  it("passes the stable-shell guard that gates the sorting phase", () => {
    expect(stableShellFindings(consumerWith(PRE_MIGRATION_SHAPE))).toEqual([]);
  });

  it("sorts within each partition and never across the paired barrier", () => {
    const before = consumerWith(PRE_MIGRATION_SHAPE);

    expect(sortLikeMigration(before)).toBe(consumerWith(SORTED_SHAPE));
    expect(sortLikeMigration(before)).not.toBe(before);
  });

  it("evaluates registration and both observers in the same order before and after the sort", () => {
    const before = runModuleGraph(bindingGraph(consumerWith(PRE_MIGRATION_SHAPE)));
    const after = runModuleGraph(bindingGraph(consumerWith(SORTED_SHAPE)));

    expect(before).toEqual(EXPECTED_TRACE);
    expect(after).toEqual(before);
  });

  it("evaluates identically under every ordering the barrier still permits", () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ABOVE_BARRIER_IMPORTS, { minLength: ABOVE_BARRIER_IMPORTS.length }),
        fc.shuffledSubarray(BELOW_BARRIER_IMPORTS, { minLength: BELOW_BARRIER_IMPORTS.length }),
        fc.shuffledSubarray(REEXPORTS, { minLength: REEXPORTS.length }),
        (above, below, reexports) => {
          const consumer = consumerWith({ above, below, reexports });
          expect(stableShellFindings(consumer)).toEqual([]);
          expect(runModuleGraph(bindingGraph(consumer))).toEqual(EXPECTED_TRACE);
        },
      ),
      { numRuns: 8 },
    );
  });
});

describe("vertical-organization binding-import-order barrier boundary", () => {
  it("changes observable evaluation order once the barrier is removed", () => {
    const unfenced = consumerWith(PRE_MIGRATION_SHAPE)
      .split("\n")
      .filter((line) => line !== BEGIN_BARRIER && line !== END_BARRIER)
      .join("\n");

    expect(stableShellFindings(unfenced)).toEqual([
      "missingSideEffectImportBeginBarrier",
      "missingSideEffectImportEndBarrier",
    ]);
    expect(runModuleGraph(bindingGraph(sortLikeMigration(unfenced)))).toEqual([
      "observed bravo-observer token=unregistered",
      "evaluated registration",
      "observed charlie-observer token=registered",
      "result alpha unregistered yankee zulu",
    ]);
  });

  it("rejects a source-bearing re-export that reaches above the barrier", () => {
    const crossing = consumerWith(PRE_MIGRATION_SHAPE)
      .replace(`${CHARLIE_REEXPORT}\n`, "")
      .replace(BEGIN_BARRIER, `${CHARLIE_REEXPORT}\n${BEGIN_BARRIER}`);

    expect(stableShellFindings(crossing)).toEqual(["importShellInterrupted"]);
    expect(runModuleGraph(bindingGraph(crossing))).toEqual([
      "observed charlie-observer token=unregistered",
      "evaluated registration",
      "observed bravo-observer token=registered",
      "result alpha registered yankee zulu",
    ]);
  });
});
