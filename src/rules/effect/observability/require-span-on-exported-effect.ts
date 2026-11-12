/**
 * @file Requires a span on exported Effect programs, written as `Effect.fn` where the export is a function.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";

type MessageId = "missingSpan" | "preferFn";

type Context = TSESLint.RuleContext<MessageId, []>;

type ExportedFunction =
  | TSESTree.FunctionDeclaration
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionExpression;

/**
 * An exported function that returns one Effect carrying its own span. A span given options does
 * not count, because the options may read the function's arguments.
 */
interface SpannedFunction {
  readonly declared: ExportedFunction;
  readonly spanName: string;
  /** The generator that becomes the `Effect.fn` body unchanged, when the rewrite is mechanical. */
  readonly generator: TSESTree.FunctionExpression | null;
}

interface ReturnedSpan {
  readonly spanName: string;
  /** The `Effect.gen` call, when nothing but the span is piped onto it. */
  readonly gen: TSESTree.CallExpression | null;
}

interface PendingExport {
  readonly node: TSESTree.Node;
  readonly name: string;
  hasEffectGen: boolean;
  hasWithSpan: boolean;
}

interface ExportScan {
  pending: PendingExport | null;
}

function spanListeners(context: Context, scan: ExportScan): TSESLint.RuleListener {
  return {
    ExportNamedDeclaration(node) {
      const name = exportName(node);
      if (name === null || node.declaration == null) {
        return;
      }
      if (isNamedFn(node.declaration)) {
        return;
      }
      const spanned = spannedFunction(node.declaration, name);
      if (spanned !== null) {
        reportPreferFn(context, name, spanned);
        return;
      }
      scan.pending = { node: node.declaration, name, hasEffectGen: false, hasWithSpan: false };
    },
    "ExportNamedDeclaration MemberExpression"(node: TSESTree.MemberExpression) {
      inspectExportMember(scan, node);
    },
    "ExportNamedDeclaration:exit"() {
      finishExport(context, scan);
    },
  };
}

function exportName(node: TSESTree.ExportNamedDeclaration): string | null {
  const declaration = node.declaration;
  if (declaration === null || declaration === undefined) {
    return null;
  }
  if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return declaration.id?.name ?? null;
  }
  if (declaration.type === AST_NODE_TYPES.VariableDeclaration) {
    return variableExportName(declaration);
  }
  return null;
}

function variableExportName(declaration: TSESTree.VariableDeclaration): string | null {
  const first = declaration.declarations[0];
  if (first === undefined) {
    return null;
  }
  if (first.id.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  return first.id.name;
}

// An export defined as `Effect.fn("name")(...)` carries the span itself.
function isNamedFn(declaration: TSESTree.Node): boolean {
  if (declaration.type !== AST_NODE_TYPES.VariableDeclaration) {
    return false;
  }
  const definition = declaration.declarations[0]?.init;
  if (definition?.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }
  const named = definition.callee;
  return (
    named.type === AST_NODE_TYPES.CallExpression &&
    named.arguments.length > 0 &&
    isEffectMember(named.callee, "fn")
  );
}

function spannedFunction(declaration: TSESTree.Node, name: string): SpannedFunction | null {
  const declared = exportedFunction(declaration);
  const span = declared === null ? null : returnedSpan(declared, name);
  if (declared === null || span === null) {
    return null;
  }
  const gen = declared.returnType === undefined ? span.gen : null;
  return { declared, spanName: span.spanName, generator: generatorOf(gen) };
}

function returnedSpan(declared: ExportedFunction, name: string): ReturnedSpan | null {
  if (declared.async || declared.generator) {
    return null;
  }
  const returned = soleReturn(declared);
  if (returned?.type !== AST_NODE_TYPES.CallExpression) {
    return null;
  }
  return isEffectGen(returned) ? { spanName: name, gen: returned } : pipedSpan(returned, name);
}

function exportedFunction(declaration: TSESTree.Node): ExportedFunction | null {
  if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return declaration;
  }
  if (declaration.type !== AST_NODE_TYPES.VariableDeclaration) {
    return null;
  }
  const init = declaration.declarations[0]?.init;
  if (
    init?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    init?.type === AST_NODE_TYPES.FunctionExpression
  ) {
    return init;
  }
  return null;
}

function soleReturn(declared: ExportedFunction): TSESTree.Expression | null {
  if (declared.body.type !== AST_NODE_TYPES.BlockStatement) {
    return declared.body;
  }
  const [only, ...rest] = declared.body.body;
  if (only?.type !== AST_NODE_TYPES.ReturnStatement || rest.length > 0) {
    return null;
  }
  return only.argument;
}

function pipedSpan(piped: TSESTree.CallExpression, name: string): ReturnedSpan | null {
  const source = memberNamed(piped.callee, "pipe")?.object;
  const span = piped.arguments.find(isOptionlessSpan);
  if (source === undefined || span === undefined) {
    return null;
  }
  const label = spanLabel(span);
  const alone = piped.arguments.length === 1 && isEffectGen(source);
  return { spanName: label ?? name, gen: alone && label !== null ? source : null };
}

function isOptionlessSpan(step: TSESTree.CallExpressionArgument): step is TSESTree.CallExpression {
  return (
    step.type === AST_NODE_TYPES.CallExpression &&
    step.arguments.length === 1 &&
    isEffectMember(step.callee, "withSpan")
  );
}

function spanLabel(span: TSESTree.CallExpression): string | null {
  const [label] = span.arguments;
  return label?.type === AST_NODE_TYPES.Literal && typeof label.value === "string"
    ? label.value
    : null;
}

function isEffectGen(node: TSESTree.Node): node is TSESTree.CallExpression {
  return node.type === AST_NODE_TYPES.CallExpression && isEffectMember(node.callee, "gen");
}

function generatorOf(gen: TSESTree.CallExpression | null): TSESTree.FunctionExpression | null {
  if (gen === null) {
    return null;
  }
  const [body, ...rest] = gen.arguments;
  if (body?.type !== AST_NODE_TYPES.FunctionExpression || rest.length > 0) {
    return null;
  }
  return body.generator && body.params.length === 0 ? body : null;
}

function reportPreferFn(context: Context, name: string, spanned: SpannedFunction): void {
  const { declared, generator, spanName } = spanned;
  context.report({
    node: declared,
    messageId: "preferFn",
    data: { name, spanName },
    fix:
      generator === null
        ? null
        : (fixer) => {
            const definition = fnDefinition(context.sourceCode, declared, generator, spanName);
            return fixer.replaceText(
              declared,
              declared.type === AST_NODE_TYPES.FunctionDeclaration
                ? `const ${name} = ${definition};`
                : definition,
            );
          },
  });
}

function fnDefinition(
  sourceCode: Readonly<TSESLint.SourceCode>,
  declared: ExportedFunction,
  generator: TSESTree.FunctionExpression,
  spanName: string,
): string {
  const typeParameters =
    declared.typeParameters === undefined ? "" : sourceCode.getText(declared.typeParameters);
  const parameters = declared.params.map((parameter) => sourceCode.getText(parameter)).join(", ");
  const body = sourceCode.getText(generator.body);
  return `Effect.fn(${JSON.stringify(spanName)})(function* ${typeParameters}(${parameters}) ${body})`;
}

function inspectExportMember(scan: ExportScan, node: TSESTree.MemberExpression): void {
  if (scan.pending === null) {
    return;
  }
  if (memberNamed(node, "withSpan") !== null) {
    scan.pending.hasWithSpan = true;
    return;
  }
  if (isEffectMember(node, "gen")) {
    scan.pending.hasEffectGen = true;
  }
}

function finishExport(context: Context, scan: ExportScan): void {
  const facts = scan.pending;
  scan.pending = null;
  if (facts === null || !facts.hasEffectGen || facts.hasWithSpan) {
    return;
  }
  context.report({
    node: facts.node,
    messageId: "missingSpan",
    data: { name: facts.name },
  });
}

function isEffectMember(node: TSESTree.Node, method: string): boolean {
  const member = memberNamed(node, method);
  return (
    member !== null &&
    member.object.type === AST_NODE_TYPES.Identifier &&
    member.object.name === "Effect"
  );
}

function memberNamed(node: TSESTree.Node, property: string): TSESTree.MemberExpression | null {
  if (node.type !== AST_NODE_TYPES.MemberExpression || node.computed) {
    return null;
  }
  return node.property.type === AST_NODE_TYPES.Identifier && node.property.name === property
    ? node
    : null;
}

/**
 * Enforces the `require-span-on-exported-effect` Agent Code Guard rule.
 */
export const requireSpanOnExportedEffect = createRule({
  name: "require-span-on-exported-effect",
  meta: {
    type: "problem",
    docs: {
      description:
        "Public Effect entrypoints must carry a span so the diagnostic chain survives across the boundary.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      missingSpan:
        'Exported Effect `{{name}}` defines an Effect.gen body without a span; add `Effect.withSpan("{{name}}")` so the trace shows up under its name.',
      preferFn:
        'Exported function `{{name}}` returns one Effect and sets its span by hand; define it as `Effect.fn("{{spanName}}")(function* (...) { ... }, ...steps)`, which names the span and records the call site. A step that needs the arguments receives them after the effect.',
    },
    schema: [],
    fixable: "code",
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return spanListeners(context, { pending: null });
  },
});
