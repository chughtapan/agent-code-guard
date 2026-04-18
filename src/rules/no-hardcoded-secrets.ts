import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const SECRET_KEY_NAMES = /^(api[_-]?key|secret|token|password|auth[_-]?token)$/i;
const PLACEHOLDER_VALUES =
  /^(test|fake|dummy|placeholder|example|sample|mock|xxx+|\.{3,}|your[-_].*)$/i;

// Canonical secret shapes. Matching any one of these is enough to flag a
// string literal regardless of the identifier it is assigned to — closes the
// rename-bypass hole that name-only gating left open (acg#10).
const SECRET_SHAPES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "Stripe key", pattern: /^(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}$/ },
  { name: "AWS access key ID", pattern: /^AKIA[0-9A-Z]{16}$/ },
  // 40-char base64-ish; collides with generic base64 payloads but matches the
  // canonical AWS secret access key shape.
  { name: "AWS secret access key", pattern: /^[A-Za-z0-9/+=]{40}$/ },
  {
    name: "JWT",
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  },
  {
    name: "GitHub personal access token (classic)",
    pattern: /^ghp_[A-Za-z0-9]{36}$/,
  },
  {
    name: "GitHub personal access token (fine-grained)",
    pattern: /^github_pat_[A-Za-z0-9_]{82}$/,
  },
  { name: "OpenAI API key", pattern: /^sk-[A-Za-z0-9]{48}$/ },
  { name: "OpenAI project API key", pattern: /^sk-proj-[A-Za-z0-9_-]{30,}$/ },
  { name: "Anthropic API key", pattern: /^sk-ant-[A-Za-z0-9_-]{30,}$/ },
];

function isSuspiciousSecretValue(value: string): boolean {
  if (value.length < 20) return false;
  if (PLACEHOLDER_VALUES.test(value)) return false;
  return /[a-zA-Z0-9_-]{20,}/.test(value);
}

function matchSecretShape(value: string): string | null {
  for (const { name, pattern } of SECRET_SHAPES) {
    if (pattern.test(value)) return name;
  }
  return null;
}

function keyName(
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
): string | null {
  if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string") {
    return key.value;
  }
  return null;
}

type Options = [{ detectEntropy?: boolean }];
type MessageIds = "hardcodedSecret";

export default createRule<Options, MessageIds>({
  name: "no-hardcoded-secrets",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag hardcoded secret-looking string literals — either assigned to a secret-looking name, or matching a canonical secret shape (Stripe, AWS, JWT, GitHub, OpenAI, Anthropic). Use environment variables instead.",
    },
    messages: {
      hardcodedSecret:
        "Hardcoded {{field}} literal — use process.env.* (or your config loader) instead",
    },
    schema: [
      {
        type: "object",
        properties: {
          detectEntropy: {
            type: "boolean",
            description:
              "Opt-in: flag high-entropy base64/hex strings that do not match a canonical shape. Off by default — noisy on checksums, hashes, and fixtures.",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [{ detectEntropy: false }],
  create(context, [options]) {
    // TODO(acg#10): implement high-entropy base64/hex detection when
    // `detectEntropy` is true. Stub only — option reserved so callers can opt
    // in once the detector lands; noisy on hashes/checksums, hence default off.
    void options.detectEntropy;

    const handledLiterals = new WeakSet<TSESTree.Node>();

    function checkLiteralFor(
      field: string,
      valueNode: TSESTree.Node,
      reportNode: TSESTree.Node,
    ) {
      if (
        valueNode.type !== AST_NODE_TYPES.Literal ||
        typeof valueNode.value !== "string"
      ) {
        return;
      }
      handledLiterals.add(valueNode);
      if (!isSuspiciousSecretValue(valueNode.value)) return;
      context.report({
        node: reportNode,
        messageId: "hardcodedSecret",
        data: { field },
      });
    }

    return {
      Property(node) {
        const name = keyName(node.key);
        if (!name || !SECRET_KEY_NAMES.test(name)) return;
        checkLiteralFor(name, node.value, node);
      },
      VariableDeclarator(node) {
        if (node.id.type !== AST_NODE_TYPES.Identifier) return;
        if (!SECRET_KEY_NAMES.test(node.id.name)) return;
        if (!node.init) return;
        checkLiteralFor(node.id.name, node.init, node);
      },
      AssignmentExpression(node) {
        const left = node.left;
        let field: string | null = null;
        if (left.type === AST_NODE_TYPES.Identifier) field = left.name;
        else if (
          left.type === AST_NODE_TYPES.MemberExpression &&
          !left.computed &&
          left.property.type === AST_NODE_TYPES.Identifier
        ) {
          field = left.property.name;
        }
        if (!field || !SECRET_KEY_NAMES.test(field)) return;
        checkLiteralFor(field, node.right, node);
      },
      Literal(node) {
        if (handledLiterals.has(node)) return;
        if (typeof node.value !== "string") return;
        const shape = matchSecretShape(node.value);
        if (!shape) return;
        context.report({
          node,
          messageId: "hardcodedSecret",
          data: { field: shape },
        });
      },
    };
  },
});
