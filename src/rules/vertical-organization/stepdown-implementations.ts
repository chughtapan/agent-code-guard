import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import type { Container, Implementation } from "./stepdown-model.js";

const EXPORTED_BAND = 0;
const INTERNAL_BAND = 1;
const CONSTRUCTOR_BAND = 0;
const PUBLIC_BAND = 1;
const PRIVATE_BAND = 2;

export function collectImplementations(
  program: TSESTree.Program,
  classBodies: readonly TSESTree.ClassBody[],
): readonly Implementation[] {
  const topLevel = collectTopLevelImplementations(program);
  return [...topLevel, ...classBodies.flatMap(collectClassImplementations)];
}

function collectTopLevelImplementations(program: TSESTree.Program): readonly Implementation[] {
  const exportedNames = exportedLocalNames(program);
  const candidates = program.body
    .flatMap(functionDeclarationsInStatement)
    .map((declaration) => topLevelImplementation(declaration, program, exportedNames));
  return assignIndexes(candidates);
}

function topLevelImplementation(
  declaration: TSESTree.FunctionDeclaration,
  program: TSESTree.Program,
  exportedNames: ReadonlySet<string>,
): Omit<Implementation, "index"> {
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
  };
}

function functionDeclarationsInStatement(
  statement: TSESTree.ProgramStatement,
): readonly TSESTree.FunctionDeclaration[] {
  if (statement.type === AST_NODE_TYPES.FunctionDeclaration) {
    return [statement];
  }
  if (isFunctionExportDeclaration(statement)) {
    return [statement.declaration];
  }
  return [];
}

function isFunctionExportDeclaration(
  statement: TSESTree.ProgramStatement,
): statement is (TSESTree.ExportNamedDeclaration | TSESTree.ExportDefaultDeclaration) & {
  readonly declaration: TSESTree.FunctionDeclaration;
} {
  return (
    (statement.type === AST_NODE_TYPES.ExportNamedDeclaration ||
      statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) &&
    statement.declaration?.type === AST_NODE_TYPES.FunctionDeclaration
  );
}

function isDirectlyExported(declaration: TSESTree.FunctionDeclaration): boolean {
  return (
    declaration.parent.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    declaration.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration
  );
}

function exportedLocalNames(program: TSESTree.Program): ReadonlySet<string> {
  const names = new Set<string>();
  for (const statement of program.body) {
    addValueExports(names, statement);
  }
  return names;
}

function addValueExports(names: Set<string>, statement: TSESTree.ProgramStatement): void {
  if (statement.type !== AST_NODE_TYPES.ExportNamedDeclaration || statement.source !== null) {
    return;
  }
  for (const specifier of statement.specifiers) {
    if (statement.exportKind === "type" || specifier.type !== AST_NODE_TYPES.ExportSpecifier || specifier.exportKind === "type") {
      continue;
    }
    names.add(specifier.local.name);
  }
}

function collectClassImplementations(classBody: TSESTree.ClassBody): readonly Implementation[] {
  const candidates = classBody.body.flatMap(classImplementation);
  return assignIndexes(candidates);
}

function classImplementation(
  member: TSESTree.ClassElement,
): readonly Omit<Implementation, "index">[] {
  if (!isEligibleMethod(member)) {
    return [];
  }
  const band = methodBand(member);
  const method = member.kind === "method" ? methodName(member) : null;
  return [{
    declaration: member,
    function: member.value,
    container: member.parent,
    band,
    bandName: classBandName(band),
    label: method ?? "constructor",
    callableName: method === null ? null : methodCallKey(member),
    isStatic: member.static,
  }];
}

function isEligibleMethod(
  member: TSESTree.ClassElement,
): member is TSESTree.MethodDefinition & { readonly value: TSESTree.FunctionExpression } {
  return member.type === AST_NODE_TYPES.MethodDefinition &&
    member.value.type === AST_NODE_TYPES.FunctionExpression &&
    (member.kind === "constructor" || (member.kind === "method" && member.decorators.length === 0));
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
  if (member.key.type === AST_NODE_TYPES.Literal) {
    return typeof member.key.value === "string" ? member.key.value : null;
  }
  if (member.key.type === AST_NODE_TYPES.Identifier || member.key.type === AST_NODE_TYPES.PrivateIdentifier) {
    return member.key.name;
  }
  return null;
}

function methodCallKey(member: TSESTree.MethodDefinition): string | null {
  const name = methodName(member);
  return name === null ? null : member.key.type === AST_NODE_TYPES.PrivateIdentifier ? `#${name}` : name;
}

function assignIndexes(
  candidates: ReadonlyArray<Omit<Implementation, "index">>,
): readonly Implementation[] {
  return [...candidates]
    .sort((left, right) => left.declaration.range[0] - right.declaration.range[0])
    .map((candidate, index) => ({ ...candidate, index }));
}

export function groupByContainer(
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

export function diagnosticDeclaration(implementation: Implementation): TSESTree.Node {
  if (implementation.declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return implementation.declaration.id ?? implementation.declaration;
  }
  return implementation.declaration.key;
}
