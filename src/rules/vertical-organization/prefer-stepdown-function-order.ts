/**
 * @file Enforces caller-before-callee narrative order within deterministic story bands.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

type FunctionImplementation = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;
type Declaration = TSESTree.FunctionDeclaration | TSESTree.MethodDefinition;
type Container = TSESTree.Program | TSESTree.ClassBody;

interface Implementation {
  readonly declaration: Declaration;
  readonly function: FunctionImplementation;
  readonly container: Container;
  readonly band: number;
  readonly bandName: string;
  readonly index: number;
  readonly label: string;
  readonly callableName: string | null;
  readonly isStatic: boolean;
}

interface Edge {
  readonly caller: Implementation;
  readonly callee: Implementation;
  readonly call: TSESTree.CallExpression;
}

interface Component {
  readonly members: readonly Implementation[];
  readonly minIndex: number;
  readonly maxIndex: number;
}

const EXPORTED_BAND = 0;
const INTERNAL_BAND = 1;
const CONSTRUCTOR_BAND = 0;
const PUBLIC_BAND = 1;
const PRIVATE_BAND = 2;

/**
 * Enforces exported/internal and class visibility story bands before ordering
 * direct local calls within each band. The rule intentionally does not fix:
 * moving declarations can change evaluation order.
 */
export const preferStepdownFunctionOrder = createRule<[],
  "declarationOutOfStoryBand" | "callerMustPrecedeCallee"
>({
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
    const sourceCode = context.sourceCode;
    const calls: TSESTree.CallExpression[] = [];

    return {
      CallExpression(node) {
        calls.push(node);
      },
      "Program:exit"(program) {
        const implementations = collectImplementations(program);
        const byFunction = new WeakMap<FunctionImplementation, Implementation>();
        for (const implementation of implementations) {
          byFunction.set(implementation.function, implementation);
        }

        const byContainer = groupByContainer(implementations);
        for (const members of byContainer.values()) {
          reportBandViolations(context, members);
        }

        const edges = collectEdges(calls, implementations, byFunction, sourceCode);
        for (const edge of violatingEdges(edges)) {
          context.report({
            node: edge.call,
            messageId: "callerMustPrecedeCallee",
            data: {
              caller: edge.caller.label,
              callee: edge.callee.label,
              band: edge.caller.bandName,
            },
          });
        }
      },
    };
  },
});

function collectImplementations(program: TSESTree.Program): readonly Implementation[] {
  const topLevel = collectTopLevelImplementations(program);
  const classes = program.body.flatMap((statement) => classBodiesInStatement(statement));
  return [...topLevel, ...classes.flatMap(collectClassImplementations)];
}

function collectTopLevelImplementations(program: TSESTree.Program): readonly Implementation[] {
  const exportedNames = exportedLocalNames(program);
  const declarations = program.body.flatMap(functionDeclarationsInStatement);
  const candidates = declarations.map((declaration) => {
    const exported = isDirectlyExported(declaration) ||
      (declaration.id !== null && exportedNames.has(declaration.id.name));
    return {
      declaration,
      function: declaration,
      container: program,
      band: exported ? EXPORTED_BAND : INTERNAL_BAND,
      bandName: exported ? "exported" : "internal",
      label: declaration.id?.name ?? "default export",
      callableName: declaration.id?.name ?? null,
      isStatic: false,
    } satisfies Omit<Implementation, "index">;
  });
  return assignIndexes(candidates);
}

function functionDeclarationsInStatement(
  statement: TSESTree.ProgramStatement,
): readonly TSESTree.FunctionDeclaration[] {
  if (statement.type === AST_NODE_TYPES.FunctionDeclaration) {
    return [statement];
  }
  if (
    (statement.type === AST_NODE_TYPES.ExportNamedDeclaration ||
      statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) &&
    statement.declaration?.type === AST_NODE_TYPES.FunctionDeclaration
  ) {
    return [statement.declaration];
  }
  return [];
}

function isDirectlyExported(declaration: TSESTree.FunctionDeclaration): boolean {
  const parent = declaration.parent;
  return (
    parent.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    parent.type === AST_NODE_TYPES.ExportDefaultDeclaration
  );
}

function exportedLocalNames(program: TSESTree.Program): ReadonlySet<string> {
  const names = new Set<string>();
  for (const statement of program.body) {
    if (
      statement.type !== AST_NODE_TYPES.ExportNamedDeclaration ||
      statement.source !== null
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type === AST_NODE_TYPES.ExportSpecifier) {
        names.add(specifier.local.name);
      }
    }
  }
  return names;
}

function classBodiesInStatement(statement: TSESTree.ProgramStatement): readonly TSESTree.ClassBody[] {
  const declaration = statement.type === AST_NODE_TYPES.ClassDeclaration
    ? statement
    : statement.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        statement.type === AST_NODE_TYPES.ExportDefaultDeclaration
      ? statement.declaration
      : null;
  return declaration?.type === AST_NODE_TYPES.ClassDeclaration ? [declaration.body] : [];
}

function collectClassImplementations(classBody: TSESTree.ClassBody): readonly Implementation[] {
  const candidates = classBody.body.flatMap((member) => {
    if (!isEligibleMethod(member)) {
      return [];
    }
    const band = methodBand(member);
    const callableName = member.kind === "method" ? methodName(member) : null;
    return [{
      declaration: member,
      function: member.value,
      container: classBody,
      band,
      bandName: classBandName(band),
      label: callableName ?? "constructor",
      callableName,
      isStatic: member.static,
    } satisfies Omit<Implementation, "index">];
  });
  return assignIndexes(candidates);
}

function isEligibleMethod(
  member: TSESTree.ClassElement,
): member is TSESTree.MethodDefinition & { readonly value: TSESTree.FunctionExpression } {
  if (member.type !== AST_NODE_TYPES.MethodDefinition) {
    return false;
  }
  if (member.value.type !== AST_NODE_TYPES.FunctionExpression) {
    return false;
  }
  return member.kind === "constructor" || (member.kind === "method" && !hasDecorators(member));
}

function hasDecorators(member: TSESTree.MethodDefinition): boolean {
  return member.decorators.length > 0;
}

function methodBand(member: TSESTree.MethodDefinition): number {
  if (member.kind === "constructor") {
    return CONSTRUCTOR_BAND;
  }
  if (member.accessibility === "private" || member.key.type === AST_NODE_TYPES.PrivateIdentifier) {
    return PRIVATE_BAND;
  }
  return PUBLIC_BAND;
}

function classBandName(band: number): string {
  if (band === CONSTRUCTOR_BAND) {
    return "constructor";
  }
  return band === PUBLIC_BAND ? "public/protected" : "private";
}

function methodName(member: TSESTree.MethodDefinition): string | null {
  if (member.computed) {
    return null;
  }
  if (
    member.key.type !== AST_NODE_TYPES.Identifier &&
    member.key.type !== AST_NODE_TYPES.PrivateIdentifier
  ) {
    return null;
  }
  return member.key.name;
}

function assignIndexes(
  candidates: readonly Omit<Implementation, "index">[],
): readonly Implementation[] {
  return [...candidates]
    .sort((left, right) => left.declaration.range[0] - right.declaration.range[0])
    .map((candidate, index) => ({ ...candidate, index }));
}

function groupByContainer(
  implementations: readonly Implementation[],
): ReadonlyMap<Container, readonly Implementation[]> {
  const groups = new Map<Container, Implementation[]>();
  for (const implementation of implementations) {
    const group = groups.get(implementation.container);
    if (group === undefined) {
      groups.set(implementation.container, [implementation]);
    } else {
      group.push(implementation);
    }
  }
  return groups;
}

function reportBandViolations(
  context: Readonly<TSESLint.RuleContext<"declarationOutOfStoryBand" | "callerMustPrecedeCallee", []>>,
  members: readonly Implementation[],
): void {
  let greatestBand: Implementation | null = null;
  for (const member of members) {
    if (greatestBand !== null && member.band < greatestBand.band) {
      context.report({
        node: diagnosticDeclaration(member),
        messageId: "declarationOutOfStoryBand",
        data: {
          name: member.label,
          currentBand: member.bandName,
          previousBand: greatestBand.bandName,
        },
      });
    }
    if (greatestBand === null || member.band > greatestBand.band) {
      greatestBand = member;
    }
  }
}

function diagnosticDeclaration(implementation: Implementation): TSESTree.Node {
  if (implementation.declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    if (implementation.declaration.id !== null) {
      return implementation.declaration.id;
    }
    return implementation.declaration;
  }
  return implementation.declaration.key;
}

function collectEdges(
  calls: readonly TSESTree.CallExpression[],
  implementations: readonly Implementation[],
  byFunction: WeakMap<FunctionImplementation, Implementation>,
  sourceCode: Readonly<TSESLint.SourceCode>,
): readonly Edge[] {
  const topLevelByName = uniqueTopLevelImplementations(implementations);
  const edges = new Map<string, Edge>();
  for (const call of calls) {
    const caller = ownerOfCall(call, byFunction);
    if (caller === null) {
      continue;
    }
    const callee = topLevelCallee(call, topLevelByName, sourceCode) ?? classCallee(call, caller, implementations);
    if (
      callee === null ||
      caller.container !== callee.container ||
      caller.band !== callee.band
    ) {
      continue;
    }
    const key = `${caller.declaration.range[0]}:${callee.declaration.range[0]}`;
    const previous = edges.get(key);
    if (previous === undefined || call.range[0] < previous.call.range[0]) {
      edges.set(key, { caller, callee, call });
    }
  }
  return [...edges.values()].sort((left, right) => left.call.range[0] - right.call.range[0]);
}

function ownerOfCall(
  call: TSESTree.CallExpression,
  byFunction: WeakMap<FunctionImplementation, Implementation>,
): Implementation | null {
  for (
    let current: TSESTree.Node | null | undefined = call.parent;
    current !== null && current !== undefined;
    current = current.parent
  ) {
    if (
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression ||
      current.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      return current.type === AST_NODE_TYPES.ArrowFunctionExpression
        ? null
        : byFunction.get(current) ?? null;
    }
  }
  return null;
}

function uniqueTopLevelImplementations(
  implementations: readonly Implementation[],
): ReadonlyMap<string, Implementation> {
  const grouped = new Map<string, Implementation[]>();
  for (const implementation of implementations) {
    if (implementation.container.type !== AST_NODE_TYPES.Program || implementation.callableName === null) {
      continue;
    }
    const group = grouped.get(implementation.callableName) ?? [];
    group.push(implementation);
    grouped.set(implementation.callableName, group);
  }
  const unique = new Map<string, Implementation>();
  for (const [name, group] of grouped) {
    if (group.length === 1) {
      unique.set(name, group[0]);
    }
  }
  return unique;
}

function topLevelCallee(
  call: TSESTree.CallExpression,
  targets: ReadonlyMap<string, Implementation>,
  sourceCode: Readonly<TSESLint.SourceCode>,
): Implementation | null {
  if (call.optional || call.callee.type !== AST_NODE_TYPES.Identifier || call.callee.optional) {
    return null;
  }
  const target = targets.get(call.callee.name);
  if (target === undefined) {
    return null;
  }
  const variable = lexicalVariable(sourceCode.getScope(call), call.callee.name);
  return variable?.defs.some((definition) => definition.node === target.declaration) ? target : null;
}

function lexicalVariable(
  initialScope: TSESLint.Scope.Scope,
  name: string,
): TSESLint.Scope.Variable | null {
  for (let scope: TSESLint.Scope.Scope | null = initialScope; scope !== null; scope = scope.upper) {
    const variable = scope.set.get(name);
    if (variable !== undefined) {
      return variable;
    }
  }
  return null;
}

function classCallee(
  call: TSESTree.CallExpression,
  caller: Implementation,
  implementations: readonly Implementation[],
): Implementation | null {
  if (call.optional || call.callee.type !== AST_NODE_TYPES.MemberExpression || call.callee.optional) {
    return null;
  }
  const member = call.callee;
  if (member.computed || member.object.type !== AST_NODE_TYPES.ThisExpression) {
    return null;
  }
  const name = member.property.type === AST_NODE_TYPES.Identifier ||
      member.property.type === AST_NODE_TYPES.PrivateIdentifier
    ? member.property.name
    : null;
  if (name === null || caller.container.type !== AST_NODE_TYPES.ClassBody) {
    return null;
  }
  const matches = implementations.filter(
    (candidate) =>
      candidate.container === caller.container &&
      candidate.callableName === name &&
      candidate.isStatic === caller.isStatic,
  );
  return matches.length === 1 ? matches[0] : null;
}

function violatingEdges(edges: readonly Edge[]): readonly Edge[] {
  const components = stronglyConnectedComponents(edges);
  const componentByMember = new Map<Implementation, Component>();
  for (const component of components) {
    for (const member of component.members) {
      componentByMember.set(member, component);
    }
  }
  return edges.filter((edge) => {
    const caller = componentByMember.get(edge.caller);
    const callee = componentByMember.get(edge.callee);
    return caller !== undefined && callee !== undefined && caller !== callee && caller.maxIndex >= callee.minIndex;
  });
}

function stronglyConnectedComponents(edges: readonly Edge[]): readonly Component[] {
  const vertices = new Set<Implementation>();
  const adjacency = new Map<Implementation, Implementation[]>();
  for (const edge of edges) {
    vertices.add(edge.caller);
    vertices.add(edge.callee);
    const neighbours = adjacency.get(edge.caller) ?? [];
    neighbours.push(edge.callee);
    adjacency.set(edge.caller, neighbours);
  }

  let nextIndex = 0;
  const indexes = new Map<Implementation, number>();
  const lowlinks = new Map<Implementation, number>();
  const stack: Implementation[] = [];
  const onStack = new Set<Implementation>();
  const components: Component[] = [];

  const visit = (vertex: Implementation): void => {
    indexes.set(vertex, nextIndex);
    lowlinks.set(vertex, nextIndex);
    nextIndex += 1;
    stack.push(vertex);
    onStack.add(vertex);
    for (const neighbour of adjacency.get(vertex) ?? []) {
      if (!indexes.has(neighbour)) {
        visit(neighbour);
        lowlinks.set(vertex, Math.min(lowlinks.get(vertex)!, lowlinks.get(neighbour)!));
      } else if (onStack.has(neighbour)) {
        lowlinks.set(vertex, Math.min(lowlinks.get(vertex)!, indexes.get(neighbour)!));
      }
    }
    if (lowlinks.get(vertex) !== indexes.get(vertex)) {
      return;
    }
    const members: Implementation[] = [];
    for (;;) {
      const member = stack.pop();
      if (member === undefined) {
        return;
      }
      onStack.delete(member);
      members.push(member);
      if (member === vertex) {
        break;
      }
    }
    const indexesInSource = members.map((member) => member.index);
    components.push({
      members,
      minIndex: Math.min(...indexesInSource),
      maxIndex: Math.max(...indexesInSource),
    });
  };

  for (const vertex of vertices) {
    if (!indexes.has(vertex)) {
      visit(vertex);
    }
  }
  return components;
}
