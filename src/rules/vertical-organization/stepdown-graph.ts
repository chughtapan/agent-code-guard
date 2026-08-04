import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import type { Container, Edge, FunctionImplementation, Implementation } from "./stepdown-model.js";
import { violatingEdges } from "./stepdown-scc.js";

export function collectViolatingEdges(
  calls: readonly TSESTree.CallExpression[],
  implementations: readonly Implementation[],
  byFunction: WeakMap<FunctionImplementation, Implementation>,
  sourceCode: Readonly<TSESLint.SourceCode>,
): readonly Edge[] {
  const topLevelTargets = uniqueTopLevelImplementations(implementations);
  const classTargets = uniqueClassImplementations(implementations);
  const edges = new Map<string, Edge>();
  for (const call of calls) {
    collectEdge(call, byFunction, sourceCode, topLevelTargets, classTargets, edges);
  }
  return violatingEdges(sortEdges(edges));
}

function collectEdge(
  call: TSESTree.CallExpression,
  byFunction: WeakMap<FunctionImplementation, Implementation>,
  sourceCode: Readonly<TSESLint.SourceCode>,
  topLevelTargets: ReadonlyMap<string, Implementation>,
  classTargets: ReadonlyMap<Container, ReadonlyMap<string, Implementation>>,
  edges: Map<string, Edge>,
): void {
  const caller = ownerOfCall(call, byFunction);
  if (caller === null) {
    return;
  }
  const callee = topLevelCallee(call, topLevelTargets, sourceCode) ?? classCallee(call, caller, classTargets);
  if (callee === null || caller.container !== callee.container || caller.band !== callee.band) {
    return;
  }
  rememberEarliestEdge(edges, { caller, callee, call });
}

function rememberEarliestEdge(edges: Map<string, Edge>, edge: Edge): void {
  const key = `${edge.caller.declaration.range[0]}:${edge.callee.declaration.range[0]}`;
  const previous = edges.get(key);
  if (previous === undefined || edge.call.range[0] < previous.call.range[0]) {
    edges.set(key, edge);
  }
}

function sortEdges(edges: ReadonlyMap<string, Edge>): readonly Edge[] {
  return [...edges.values()].sort((left, right) => left.call.range[0] - right.call.range[0]);
}

function uniqueClassImplementations(
  implementations: readonly Implementation[],
): ReadonlyMap<Container, ReadonlyMap<string, Implementation>> {
  const grouped = groupClassTargets(implementations);
  return new Map([...grouped].map(([container, targets]) => [container, uniqueTargets(targets)]));
}

function groupClassTargets(
  implementations: readonly Implementation[],
): ReadonlyMap<Container, ReadonlyMap<string, readonly Implementation[]>> {
  const grouped = new Map<Container, Map<string, Implementation[]>>();
  for (const implementation of implementations) {
    if (implementation.container.type !== AST_NODE_TYPES.ClassBody || implementation.callableName === null) {
      continue;
    }
    const targets = grouped.get(implementation.container) ?? new Map<string, Implementation[]>();
    const key = `${implementation.isStatic}:${implementation.callableName}`;
    targets.set(key, [...(targets.get(key) ?? []), implementation]);
    grouped.set(implementation.container, targets);
  }
  return grouped;
}

function uniqueTargets(
  targets: ReadonlyMap<string, readonly Implementation[]>,
): ReadonlyMap<string, Implementation> {
  return new Map(
    [...targets].flatMap(([key, candidates]) => candidates.length === 1 ? [[key, candidates[0]] as const] : []),
  );
}

function ownerOfCall(
  call: TSESTree.CallExpression,
  byFunction: WeakMap<FunctionImplementation, Implementation>,
): Implementation | null {
  for (let current: TSESTree.Node | null | undefined = call.parent; current != null; current = current.parent) {
    if (!isFunctionBoundary(current)) {
      continue;
    }
    return current.type === AST_NODE_TYPES.ArrowFunctionExpression ? null : byFunction.get(current) ?? null;
  }
  return null;
}

function isFunctionBoundary(
  node: TSESTree.Node,
): node is FunctionImplementation | TSESTree.ArrowFunctionExpression {
  return node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression;
}

function uniqueTopLevelImplementations(
  implementations: readonly Implementation[],
): ReadonlyMap<string, Implementation> {
  const grouped = new Map<string, Implementation[]>();
  for (const implementation of implementations) {
    if (implementation.container.type === AST_NODE_TYPES.Program && implementation.callableName !== null) {
      const group = grouped.get(implementation.callableName) ?? [];
      group.push(implementation);
      grouped.set(implementation.callableName, group);
    }
  }
  return uniqueTargets(grouped);
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
  targets: ReadonlyMap<Container, ReadonlyMap<string, Implementation>>,
): Implementation | null {
  if (call.optional || call.callee.type !== AST_NODE_TYPES.MemberExpression || call.callee.optional) {
    return null;
  }
  const name = directThisMethodName(call.callee);
  if (name === null || caller.container.type !== AST_NODE_TYPES.ClassBody) {
    return null;
  }
  return targets.get(caller.container)?.get(`${caller.isStatic}:${name}`) ?? null;
}

function directThisMethodName(member: TSESTree.MemberExpression): string | null {
  if (member.computed || member.object.type !== AST_NODE_TYPES.ThisExpression) {
    return null;
  }
  if (member.property.type === AST_NODE_TYPES.PrivateIdentifier) {
    return `#${member.property.name}`;
  }
  return member.property.type === AST_NODE_TYPES.Identifier ? member.property.name : null;
}
