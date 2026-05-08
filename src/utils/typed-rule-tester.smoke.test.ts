import { ESLintUtils, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { requireServices } from "./parser-services.js";
import { createTypedRuleTester } from "./typed-rule-tester.js";

const createRule = ESLintUtils.RuleCreator(() => "https://example.test/smoke");

const probeRule = createRule<[], "stringType" | "noProgram">({
  name: "_probe",
  meta: {
    type: "problem",
    docs: { description: "smoke test for typed-linter infra" },
    messages: {
      stringType: "found a string-typed identifier",
      noProgram: "no program available",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const services = requireServices(context);
    return {
      VariableDeclarator(node) {
        if (services === null) {
          context.report({ node, messageId: "noProgram" });
          return;
        }
        if (node.id.type !== AST_NODE_TYPES.Identifier) return;
        const checker = services.program.getTypeChecker();
        const tsNode = services.esTreeNodeToTSNodeMap.get(node.id);
        const typeStr = checker.typeToString(checker.getTypeAtLocation(tsNode));
        if (typeStr === "string") {
          context.report({ node, messageId: "stringType" });
        }
      },
    };
  },
});

const ruleTester = createTypedRuleTester();

ruleTester.run("_typed-linter-smoke", probeRule, {
  valid: [
    {
      code: "const x = 42;",
      filename: "src/utils/test-support/typed-fixture.ts",
    },
  ],
  invalid: [
    {
      code: "const x: string = 'hello';",
      filename: "src/utils/test-support/typed-fixture.ts",
      errors: [{ messageId: "stringType" }],
    },
  ],
});
