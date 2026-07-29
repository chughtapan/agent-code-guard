import {
  type ParserServicesWithTypeInformation,
  type TSESLint,
  ESLintUtils,
} from "@typescript-eslint/utils";

/**
 * Returns complete TypeScript parser services when the active lint config
 * provides them, otherwise returns null.
 * @param context The active typed rule context.
 * @returns Complete parser services, or `null` when type information is absent.
 */
export function requireServices<MessageIds extends string, Options extends readonly unknown[]>(
  context: TSESLint.RuleContext<MessageIds, Options>,
): ParserServicesWithTypeInformation | null {
  const services = ESLintUtils.getParserServices(context, true);
  if (services.program === null) {
    return null;
  }
  return services;
}
