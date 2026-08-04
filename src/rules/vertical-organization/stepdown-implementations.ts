import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import type { Container, Implementation } from "./stepdown-model.js";

const EXPORTED_BAND = 0;
const INTERNAL_BAND = 1;
const CONSTRUCTOR_BAND = 0;
const PUBLIC_BAND = 1;
const PRIVATE_BAND = 2;

/**
 * Collects the top-level functions and eligible class methods ordered within
 * their containing story bands.
 *
 * @param program Parsed source-file program.
 * @param classBodies Class bodies encountered in the source file.
 * @returns Indexed implementations from the program and its classes.
 */
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
  const exported = isExportedImplementation(declaration, exportedNames);
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

function isExportedImplementation(
  declaration: TSESTree.FunctionDeclaration,
  exportedNames: ReadonlySet<string>,
): boolean {
  if (isDirectlyExported(declaration)) {
    return true;
  }
  const name = declaration.id?.name;
  return name !== undefined && exportedNames.has(name);
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
  // Local named exports are represented as ExportSpecifier nodes by the parser;
  // namespace exports always carry a source and returned above.
  const specifiers = (
    // Safe because source-less named exports contain only ExportSpecifier nodes.
    statement.specifiers as readonly TSESTree.ExportSpecifier[]
  );
  for (const specifier of specifiers) {
    if (statement.exportKind === "type" || specifier.exportKind === "type") {
      continue;
    }
    names.add(
      // Safe because a local ExportSpecifier names an in-file identifier binding.
      (specifier.local as TSESTree.Identifier).name,
    );
  }
}

function collectClassImplementations(classBody: TSESTree.ClassBody): readonly Implementation[] {
  const candidates = classBody.body.flatMap(classImplementation);
  return assignIndexes(candidates);
}

function classImplementation(
  member: TSESTree.ClassElement,
): ReadonlyArray<Omit<Implementation, "index">> {
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
    label: methodLabel(member, method),
    callableName: method === null ? null : methodCallKey(member, method),
    isStatic: member.static,
  }];
}

function isEligibleMethod(
  member: TSESTree.ClassElement,
): member is TSESTree.MethodDefinition & { readonly value: TSESTree.FunctionExpression } {
  // ESTree's MethodDefinition node always owns a FunctionExpression; empty-body
  // signatures use a distinct TS node and are excluded by this discriminant.
  if (member.type !== AST_NODE_TYPES.MethodDefinition) {
    return false;
  }
  if (member.kind === "constructor") {
    return true;
  }
  return member.kind === "method" && member.decorators.length === 0;
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
  if (member.key.type === AST_NODE_TYPES.Identifier || member.key.type === AST_NODE_TYPES.PrivateIdentifier) {
    return member.key.name;
  }
  return null;
}

function methodLabel(member: TSESTree.MethodDefinition, name: string | null): string {
  if (member.kind === "constructor") {
    return "constructor";
  }
  if (name !== null) {
    return name;
  }
  return member.computed ? "computed method" : "literal-key method";
}

function methodCallKey(member: TSESTree.MethodDefinition, name: string): string {
  return member.key.type === AST_NODE_TYPES.PrivateIdentifier ? `#${name}` : name;
}

function assignIndexes(
  candidates: ReadonlyArray<Omit<Implementation, "index">>,
): readonly Implementation[] {
  return candidates.map((candidate, index) => ({ ...candidate, index }));
}

/**
 * Groups implementations by their program or class-body container.
 *
 * @param implementations Implementations to group.
 * @returns Implementations keyed by their containing AST node.
 */
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

/**
 * Selects the most useful declaration node for an ordering diagnostic.
 *
 * @param implementation Implementation being reported.
 * @returns Named declaration node when available.
 */
export function diagnosticDeclaration(implementation: Implementation): TSESTree.Node {
  if (implementation.declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return implementation.declaration.id ?? implementation.declaration;
  }
  return implementation.declaration.key;
}
