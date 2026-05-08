import type { TSESLint } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";

type ParserServicesWithProgram = ReturnType<typeof ESLintUtils.getParserServices>;

export function requireServices<MessageIds extends string, Options extends readonly unknown[]>(
  context: TSESLint.RuleContext<MessageIds, Options>,
): ParserServicesWithProgram | null {
  const services = ESLintUtils.getParserServices(context, true);
  if (services.program === null) return null;
  return services as ParserServicesWithProgram;
}
