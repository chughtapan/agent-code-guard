import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { getStaticMemberExpression } from "../utils/ast-refinement/index.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

type ConstructorKind = "brand" | "schema";

interface ConstructorBinding {
  readonly kind: ConstructorKind;
  readonly name: string;
  readonly node: TSESTree.Node;
}

const SCHEMA_FACTORIES = new Map<string, ReadonlySet<string>>([
  ["Schema", new Set(["Array", "Boolean", "Literal", "Number", "Object", "Record", "String", "Struct", "Tuple", "Union"])],
  ["Type", new Set(["Array", "Boolean", "Literal", "Number", "Object", "Record", "String", "Tuple", "Union"])],
  ["z", new Set(["array", "boolean", "literal", "number", "object", "record", "string", "tuple", "union"])],
]);

export default createRule({
  name: "no-exported-brand-constructor",
  meta: {
    type: "problem",
    docs: {
      description: "Exporting a brand's smart constructor breaks the encapsulation that makes the brand load-bearing; the constructor stays private to the module that owns the validation.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      exportedBrandConstructor:
        "Do not export {{kind}} constructor {{name}}. Define and use it in the same file; export derived types or boundary functions instead.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const constructors = new Map<string, ConstructorBinding>();
    const exportedNames = new Set<string>();
    const reported = new Set<string>();

    function report(binding: ConstructorBinding): void {
      if (reported.has(binding.name)) return;
      reported.add(binding.name);
      context.report({
        node: binding.node,
        messageId: "exportedBrandConstructor",
        data: { kind: binding.kind, name: binding.name },
      });
    }

    function markExported(name: string): void {
      exportedNames.add(name);
      const binding = constructors.get(name);
      if (binding) report(binding);
    }

    return {
      VariableDeclarator(node) {
        const binding = constructorBinding(node);
        if (binding === null) return;
        constructors.set(binding.name, binding);
        if (exportedNames.has(binding.name) || isDirectlyExported(node)) {
          report(binding);
        }
      },
      ExportNamedDeclaration(node) {
        for (const specifier of node.specifiers) {
          if (specifier.local.type === AST_NODE_TYPES.Identifier) {
            markExported(specifier.local.name);
          }
        }
      },
    };
  },
});

function constructorBinding(
  node: TSESTree.VariableDeclarator,
): ConstructorBinding | null {
  if (node.id.type !== AST_NODE_TYPES.Identifier) return null;
  if (node.init === null) return null;
  const kind = constructorKind(node.init);
  return kind === null ? null : { kind, name: node.id.name, node };
}

function constructorKind(node: TSESTree.Expression): ConstructorKind | null {
  if (node.type !== AST_NODE_TYPES.CallExpression) return null;
  if (isBrandNominalCall(node)) return "brand";
  return isSchemaConstructorCall(node) ? "schema" : null;
}

function isBrandNominalCall(node: TSESTree.CallExpression): boolean {
  const callee = getStaticMemberExpression(node.callee);
  return callee !== null &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === "Brand" &&
    callee.property.name === "nominal";
}

function isSchemaConstructorCall(node: TSESTree.CallExpression): boolean {
  const callee = getStaticMemberExpression(node.callee);
  if (callee === null) return false;
  const root = schemaRootName(callee.object);
  const factories = root === null ? undefined : SCHEMA_FACTORIES.get(root);
  return factories?.has(callee.property.name) ?? false;
}

function schemaRootName(node: TSESTree.Expression): string | null {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  const member = getStaticMemberExpression(node);
  return member === null ? null : schemaRootName(member.object);
}

function isDirectlyExported(node: TSESTree.Node): boolean {
  const declaration = parentOf(node);
  const exportNode = declaration === null ? null : parentOf(declaration);
  return exportNode?.type === AST_NODE_TYPES.ExportNamedDeclaration;
}

function parentOf(node: TSESTree.Node): TSESTree.Node | null {
  return (node as TSESTree.Node & { readonly parent?: TSESTree.Node }).parent ?? null;
}
