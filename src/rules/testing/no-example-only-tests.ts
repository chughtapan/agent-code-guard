import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { isTestFile } from "../../utils/is-test-file.js";
import { getStaticMemberPropertyName } from "../../utils/ast-refinement/index.js";

type MessageIds = "exampleOnly";
type Options = [{
  readonly minExamplesBeforeWarning?: number;
  readonly testFunctionNames?: readonly string[];
  readonly describeFunctionNames?: readonly string[];
  readonly propertyCallNames?: readonly string[];
  readonly ignoreFilenamePatterns?: readonly string[];
  readonly regressionOnlyCommentPattern?: string;
}];

interface NormalizedOptions {
  readonly minExamplesBeforeWarning: number;
  readonly testFunctionNames: ReadonlySet<string>;
  readonly describeFunctionNames: ReadonlySet<string>;
  readonly propertyCallNames: ReadonlySet<string>;
  readonly ignoreFilenamePatterns: readonly RegExp[];
  readonly regressionOnlyCommentPattern: RegExp;
}

interface SuiteScope {
  readonly owner: TSESTree.Node;
  readonly examples: TSESTree.CallExpression[];
  hasProperty: boolean;
}

const DEFAULT_IGNORED_FILENAMES = [
  String.raw`[\\/]e2e[\\/]`,
  String.raw`\.e2e\.[cm]?[jt]sx?$`,
  String.raw`\.snapshot\.[cm]?[jt]sx?$`,
];

export default createRule<Options, MessageIds>({
  name: "no-example-only-tests",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag test scopes that accumulate example cases without a property or generative invariant test.",
    },
    messages: {
      exampleOnly:
        "This test scope has {{count}} example tests and no property/generative test. Add an invariant test, or mark the scope regression-only with a reason.",
    },
    schema: [
      {
        type: "object",
        properties: {
          minExamplesBeforeWarning: { type: "integer", minimum: 1 },
          testFunctionNames: { type: "array", items: { type: "string" } },
          describeFunctionNames: { type: "array", items: { type: "string" } },
          propertyCallNames: { type: "array", items: { type: "string" } },
          ignoreFilenamePatterns: { type: "array", items: { type: "string" } },
          regressionOnlyCommentPattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [{}],
  create(context, [rawOptions]) {
    if (!isTestFile(context.filename)) return {};
    const options = normalizeOptions(rawOptions);
    if (ignoredFilename(context.filename, options)) return {};
    if (hasRegressionOnlyComment(context.sourceCode.getAllComments(), options)) return {};

    const scopes: SuiteScope[] = [];

    return {
      Program(node) {
        scopes.push(createScope(node));
      },
      "Program:exit"() {
        reportAndPopScope(context, scopes, options);
      },
      CallExpression(node) {
        if (isDescribeCall(node, options)) scopes.push(createScope(node));
        if (isPropertyEvidenceCall(node, options)) markCurrentScopeProperty(scopes);
        if (isExampleTestCall(node, options)) addCurrentScopeExample(scopes, node);
      },
      "CallExpression:exit"(node) {
        const scope = lastScope(scopes);
        if (scope !== null && scope.owner === node) reportAndPopScope(context, scopes, options);
      },
    };
  },
});

function normalizeOptions(rawOptions: Options[number]): NormalizedOptions {
  return {
    minExamplesBeforeWarning: rawOptions.minExamplesBeforeWarning ?? 2,
    testFunctionNames: new Set(rawOptions.testFunctionNames ?? ["it", "test"]),
    describeFunctionNames: new Set(rawOptions.describeFunctionNames ?? ["describe"]),
    propertyCallNames: new Set(rawOptions.propertyCallNames ?? [
      "fc.property",
      "fc.asyncProperty",
      "it.prop",
      "test.prop",
    ]),
    ignoreFilenamePatterns: compilePatterns(
      rawOptions.ignoreFilenamePatterns ?? DEFAULT_IGNORED_FILENAMES,
    ),
    regressionOnlyCommentPattern: compilePattern(
      rawOptions.regressionOnlyCommentPattern ?? "@agent-code-guard/regression-only:",
    ),
  };
}

function isDescribeCall(node: TSESTree.CallExpression, options: NormalizedOptions): boolean {
  const pathName = callPath(node);
  if (pathName === null) return false;
  return options.describeFunctionNames.has(rootName(pathName)) && hasFunctionArgument(node);
}

function isExampleTestCall(node: TSESTree.CallExpression, options: NormalizedOptions): boolean {
  const pathName = callPath(node);
  if (pathName === null || isPropertyPath(pathName, options)) return false;
  return options.testFunctionNames.has(rootName(pathName)) && hasFunctionArgument(node);
}

function isPropertyEvidenceCall(
  node: TSESTree.CallExpression,
  options: NormalizedOptions,
): boolean {
  const pathName = callPath(node);
  return pathName !== null && isPropertyPath(pathName, options);
}

function callPath(node: TSESTree.CallExpression): string | null {
  return calleePath(node.callee);
}

function calleePath(node: TSESTree.CallExpression["callee"]): string | null {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (node.type === AST_NODE_TYPES.CallExpression) return callPath(node);
  if (node.type === AST_NODE_TYPES.ChainExpression) return calleePath(node.expression);
  if (node.type !== AST_NODE_TYPES.MemberExpression) return null;
  const objectPath = expressionPath(node.object);
  const propertyName = getStaticMemberPropertyName(node);
  return objectPath !== null && propertyName !== null ? `${objectPath}.${propertyName}` : null;
}

function expressionPath(node: TSESTree.Expression | TSESTree.Super): string | null {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (node.type === AST_NODE_TYPES.CallExpression) return callPath(node);
  if (node.type === AST_NODE_TYPES.ChainExpression) return expressionPath(node.expression);
  if (node.type !== AST_NODE_TYPES.MemberExpression) return null;
  return calleePath(node);
}

function hasFunctionArgument(node: TSESTree.CallExpression): boolean {
  return node.arguments.some((argument) =>
    argument.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    argument.type === AST_NODE_TYPES.FunctionExpression
  );
}

function isPropertyPath(pathName: string, options: NormalizedOptions): boolean {
  return options.propertyCallNames.has(pathName);
}

function rootName(pathName: string): string {
  return pathName.split(".")[0] ?? pathName;
}

function reportAndPopScope(
  context: Readonly<{ report: (descriptor: ReportDescriptor) => void }>,
  scopes: SuiteScope[],
  options: NormalizedOptions,
): void {
  const scope = scopes.pop();
  if (scope === undefined || scope.hasProperty) return;
  if (scope.examples.length < options.minExamplesBeforeWarning) return;
  context.report({
    node: scope.examples[0]!,
    messageId: "exampleOnly",
    data: { count: String(scope.examples.length) },
  });
}

function markCurrentScopeProperty(scopes: readonly SuiteScope[]): void {
  const scope = lastScope(scopes);
  if (scope !== null) scope.hasProperty = true;
}

function addCurrentScopeExample(
  scopes: readonly SuiteScope[],
  node: TSESTree.CallExpression,
): void {
  const scope = lastScope(scopes);
  if (scope !== null) scope.examples.push(node);
}

function lastScope(scopes: readonly SuiteScope[]): SuiteScope | null {
  const scope = scopes[scopes.length - 1];
  return scope ?? null;
}

function createScope(owner: TSESTree.Node): SuiteScope {
  return { owner, examples: [], hasProperty: false };
}

function ignoredFilename(filename: string, options: NormalizedOptions): boolean {
  return options.ignoreFilenamePatterns.some((pattern) => pattern.test(filename));
}

function hasRegressionOnlyComment(
  comments: readonly TSESTree.Comment[],
  options: NormalizedOptions,
): boolean {
  return comments.some((comment) => options.regressionOnlyCommentPattern.test(comment.value));
}

function compilePatterns(patterns: readonly string[]): readonly RegExp[] {
  return patterns.map((pattern) => new RegExp(pattern));
}

function compilePattern(pattern: string): RegExp {
  return new RegExp(pattern);
}

type ReportDescriptor = {
  readonly node: TSESTree.Node;
  readonly messageId: MessageIds;
  readonly data: Readonly<Record<string, string>>;
};
