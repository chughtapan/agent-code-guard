import type { ParserServicesWithTypeInformation, TSESLint } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";

export function requireServices<MessageIds extends string, Options extends readonly unknown[]>(
  context: TSESLint.RuleContext<MessageIds, Options>,
): ParserServicesWithTypeInformation | null {
  const services = ESLintUtils.getParserServices(context, true);
  if (services.program === null) return null;
  return services as ParserServicesWithTypeInformation;
}
