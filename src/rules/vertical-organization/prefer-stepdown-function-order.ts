/**
 * @file Enforces caller-before-callee narrative order within deterministic story bands.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import {
  collectImplementations,
  diagnosticDeclaration,
  groupByContainer,
} from "./stepdown-implementations.js";
import { collectViolatingEdges } from "./stepdown-graph.js";
import type { FunctionImplementation, Implementation } from "./stepdown-model.js";

type MessageIds = "declarationOutOfStoryBand" | "callerMustPrecedeCallee";

/**
 * Enforces exported/internal and class visibility story bands before ordering
 * direct local calls within each band. The rule intentionally does not fix:
 * moving declarations can change evaluation order.
 */
export const preferStepdownFunctionOrder = createRule<[], MessageIds>({
  name: "prefer-stepdown-function-order",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Keep exported functions and visible class methods before internal implementation detail, then keep direct callers before their local callees.",
      url: PRINCIPLE_URL.DISCIPLINE,
    },
    messages: {
      declarationOutOfStoryBand:
        "{{name}} belongs to the {{currentBand}} story band, which must precede an earlier {{previousBand}} declaration.",
      callerMustPrecedeCallee:
        "{{caller}} must precede its direct local callee {{callee}} in the {{band}} story band.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const calls: TSESTree.CallExpression[] = [];
    const classBodies: TSESTree.ClassBody[] = [];
    return {
      CallExpression(node) {
        calls.push(node);
      },
      ClassBody(node) {
        classBodies.push(node);
      },
      "Program:exit"(program) {
        reportViolations(context, program, classBodies, calls);
      },
    };
  },
});

function reportViolations(
  context: Readonly<TSESLint.RuleContext<MessageIds, []>>,
  program: TSESTree.Program,
  classBodies: readonly TSESTree.ClassBody[],
  calls: readonly TSESTree.CallExpression[],
): void {
  const implementations = collectImplementations(program, classBodies);
  reportBandViolations(context, groupByContainer(implementations));
  const byFunction = functionImplementations(implementations);
  for (const edge of collectViolatingEdges(calls, implementations, byFunction, context.sourceCode)) {
    context.report({
      node: edge.call,
      messageId: "callerMustPrecedeCallee",
      data: { caller: edge.caller.label, callee: edge.callee.label, band: edge.caller.bandName },
    });
  }
}

function functionImplementations(
  implementations: readonly Implementation[],
): WeakMap<FunctionImplementation, Implementation> {
  return new WeakMap(implementations.map((implementation) => [implementation.function, implementation]));
}

function reportBandViolations(
  context: Readonly<TSESLint.RuleContext<MessageIds, []>>,
  groups: ReadonlyMap<TSESTree.Program | TSESTree.ClassBody, readonly Implementation[]>,
): void {
  for (const members of groups.values()) {
    reportContainerBandViolations(context, members);
  }
}

function reportContainerBandViolations(
  context: Readonly<TSESLint.RuleContext<MessageIds, []>>,
  members: readonly Implementation[],
): void {
  let greatestBand: number | null = null;
  let greatestBandName: string | null = null;
  for (const member of members) {
    if (greatestBand !== null && member.band < greatestBand && greatestBandName !== null) {
      reportBandViolation(context, member, greatestBandName);
    }
    const nextGreatestBand = Math.max(greatestBand ?? member.band, member.band);
    if (nextGreatestBand !== greatestBand) {
      greatestBandName = member.bandName;
    }
    greatestBand = nextGreatestBand;
  }
}

function reportBandViolation(
  context: Readonly<TSESLint.RuleContext<MessageIds, []>>,
  member: Implementation,
  previousBand: string,
): void {
  context.report({
    node: diagnosticDeclaration(member),
    messageId: "declarationOutOfStoryBand",
    data: { name: member.label, currentBand: member.bandName, previousBand },
  });
}
