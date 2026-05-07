import path from "node:path";
import { Data, Either, Schema } from "effect";
import { ArrayFormatter } from "effect/ParseResult";
import { ArchitectureOptionsSchema, type ArchitectureOptionsInput } from "./option-schemas.js";
import type { ResolvedArchitectureOptions } from "./types.js";

const decodeOptions = Schema.decodeUnknownEither(ArchitectureOptionsSchema);

// Memoize on the raw input reference. ESLint calls create() for every rule
// per file; the same rawOptions object flows through identical decode work
// thousands of times in a single lint pass.
const memo = new WeakMap<object, ResolvedArchitectureOptions>();

export interface ArchitectureOptionsIssue {
  readonly path: ReadonlyArray<PropertyKey>;
  readonly message: string;
}

export class ArchitectureOptionsError extends Data.TaggedError("ArchitectureOptionsError")<{
  readonly message: string;
  readonly issues: ReadonlyArray<ArchitectureOptionsIssue>;
}> {}

export function resolveArchitectureOptions(
  raw: unknown = {},
): ResolvedArchitectureOptions {
  if (typeof raw === "object" && raw !== null) {
    const cached = memo.get(raw);
    if (cached) return cached;
  }

  return Either.match(decodeOptions(raw), {
    onLeft: (parseError) => {
      const issues: ArchitectureOptionsIssue[] = ArrayFormatter.formatErrorSync(parseError).map((issue) => ({
        path: issue.path,
        message: issue.message,
      }));
      const summary = issues
        .map((issue) =>
          issue.path.length > 0
            ? `  • ${issue.path.join(".")}: ${issue.message}`
            : `  • ${issue.message}`,
        )
        .join("\n");
      throw new ArchitectureOptionsError({
        message: `Invalid agent-code-guard architecture options:\n${summary}`,
        issues,
      });
    },
    onRight: (parsed) => {
      const projectRoot = path.resolve(parsed.projectRoot ?? process.cwd());
      const resolved: ResolvedArchitectureOptions = {
        ...parsed,
        projectRoot,
        tsconfigPath: parsed.tsconfigPath
          ? path.resolve(projectRoot, parsed.tsconfigPath)
          : null,
      };
      if (typeof raw === "object" && raw !== null) {
        memo.set(raw, resolved);
      }
      return resolved;
    },
  });
}

export type ArchitectureRuleOptionInput = ArchitectureOptionsInput;
