# agent-code-guard vertical-organization calibration

Status: pending review.

## Input

| Field | Value |
|---|---|
| Corpus | agent-code-guard |
| Root | `/tmp/acg-pr1.u2efev` |
| Revision | `637edb331276c3d0fe6f04353defad1092a58f72` |
| Command | `"/tmp/acg-pr1.u2efev/scripts/calibrate-vertical-organization.mts" "--corpus" "agent-code-guard" "--root" "/tmp/acg-pr1.u2efev" "--revision" "637edb331276c3d0fe6f04353defad1092a58f72" "--globs" "**/*.{ts,tsx,mts,cts}" "--exclude" "node_modules/**,dist/**,coverage/**,bench/fixtures/**" "--out" "/tmp/acg-pr1.u2efev/docs/calibration/vertical-organization/agent-code-guard.md"` |
| Globs | `**/*.{ts,tsx,mts,cts}` |
| Excludes | `node_modules/**,dist/**,coverage/**,bench/fixtures/**` |

## Dependency versions

- `comment-parser`: `1.4.1`
- `eslint-plugin-perfectionist`: `5.10.1`
- `eslint-plugin-import-x`: `4.17.1`
- `eslint-plugin-jsdoc`: `62.9.0`

## Per-rule findings

| Rule | Findings |
|---|---:|
| `agent-code-guard/no-vacuous-jsdoc` | 0 |
| `agent-code-guard/require-stable-file-shell` | 135 |
| `agent-code-guard/prefer-stepdown-function-order` | 274 |

## Deterministic inspection sample

| Finding | Classification | Notes |
|---|---|---|
| `bench/generate-fixture.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `bench/generate-fixture.ts:114:3:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/generate-fixture.ts:117:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/generate-fixture.ts:126:3:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/generate-fixture.ts:129:52:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/generate-fixture.ts:208:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/generate-fixture.ts:48:15:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/generate-fixture.ts:54:29:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `bench/lint-bench.ts:128:15:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:137:21:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:166:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:200:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:201:19:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:217:15:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:219:25:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:223:20:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:224:3:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-bench.ts:226:27:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-one.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `bench/lint-one.ts:101:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-one.ts:115:22:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `bench/lint-one.ts:85:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `scripts/apply-vertical-organization-fix.mts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `scripts/calibrate-vertical-organization.mts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `scripts/calibrate-vertical-organization.mts:139:26:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `scripts/calibrate-vertical-organization.mts:171:3:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `scripts/calibrate-vertical-organization.mts:62:14:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `scripts/calibrate-vertical-organization.mts:93:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/init.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/knip.ts:3:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/plugin-configs.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/async-keyword.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/async-keyword.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/bare-catch.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/bare-catch.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/conditional-chaining-parameters.ts:111:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/async-flow/no-conditional-chaining.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/no-conditional-chaining.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/no-unbounded-concurrency.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/no-unbounded-concurrency.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/promise-type.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/promise-type.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/then-chain.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/async-flow/then-chain.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/discriminants/either-discriminant.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/discriminants/either-discriminant.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/discriminants/tag-discriminant.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/discriminants/tag-discriminant.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/discriminants/tag-discriminant.ts:37:22:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/discriminants/tag-discriminant.ts:41:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/error/effect-error-erasure.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/error/effect-error-erasure.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/error/effect-error-erasure.ts:29:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/error/effect-promise.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/error/effect-promise.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/error/no-effect-error-coalescing.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/error/no-effect-error-coalescing.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/annotate-without-span.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/annotate-without-span.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/handler-requires-span.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/handler-requires-span.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/handler-requires-span.ts:62:66:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/observability/handler-requires-span.ts:67:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/observability/handler-requires-span.ts:70:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/observability/logger-config-at-boot.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/logger-config-at-boot.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/no-console-in-effect.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/no-console-in-effect.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/prefer-annotate-logs.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/prefer-annotate-logs.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/require-span-on-exported-effect.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/require-span-on-exported-effect.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/observability/require-span-on-exported-effect.ts:26:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/observability/require-span-on-exported-effect.ts:29:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/runtime/effect-foreach-requires-concurrency.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/runtime/effect-foreach-requires-concurrency.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/runtime/no-promise-all-in-effect.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/runtime/no-promise-all-in-effect.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/runtime/prefer-config-redacted.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/runtime/prefer-config-redacted.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/runtime/prefer-effect-platform.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/runtime/prefer-effect-platform.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/schema/no-schema-type-cast.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/schema/no-schema-type-cast.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/schema/parse-into-schema-requires-effect.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/schema/parse-into-schema-requires-effect.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/schema/parse-into-schema-requires-effect.ts:100:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/schema/parse-into-schema-requires-effect.ts:106:9:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/schema/parse-into-schema-requires-effect.ts:177:8:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/schema/parse-into-schema-requires-effect.ts:90:8:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/schema/prefer-decode-effect-at-boundary.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/schema/prefer-decode-effect-at-boundary.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/schema/prefer-decode-effect-at-boundary.ts:112:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/schema/prefer-decode-effect-at-boundary.ts:115:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/schema/prefer-decode-effect-at-boundary.ts:177:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/schema/prefer-decode-effect-at-boundary.ts:180:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/scope/acquire-release-requires-scope.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/scope/acquire-release-requires-scope.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/scope/finalizer-requires-scope.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/scope/finalizer-requires-scope.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/scope/finalizer-requires-scope.ts:39:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/effect/scope/fork-requires-lifecycle.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/scope/fork-requires-lifecycle.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/scope/runpromise-requires-scoped.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/effect/scope/runpromise-requires-scoped.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/google-style/assertions.ts:47:19:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/assertions.ts:51:8:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/classes.ts:149:22:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/classes.ts:39:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/classes.ts:50:25:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/classes.ts:54:9:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-function-naming.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/google-style/component-function-naming.ts:102:21:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-function-naming.ts:57:30:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:104:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:111:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:112:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:165:6:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:186:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:190:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:193:23:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:197:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/component-return-signals.ts:210:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:110:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:120:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:124:20:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:140:22:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:156:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:167:20:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:185:20:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:201:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:205:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:210:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:30:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:82:21:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/descriptor-accessors.ts:89:23:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/enum-coercion.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/google-style/enum-coercion.ts:104:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:145:9:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:162:34:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:162:60:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:166:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:195:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:212:8:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:216:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:62:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:64:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:72:59:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/expressions.ts:96:7:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:143:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:174:59:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:191:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:191:51:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:206:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:206:36:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:227:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:227:47:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:64:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:65:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/mutation.ts:66:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/google-style/syntax.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/google-style/type-shape.ts:63:9:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/brand-helper.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/manual-algebra/detection/brand-helper.ts:24:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/brand.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/manual-algebra/detection/exclusions.ts:47:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/exclusions.ts:65:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:130:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:147:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:152:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:152:65:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:158:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:159:34:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:181:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:183:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:192:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:198:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:198:59:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:202:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:202:59:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:217:12:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:219:16:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:233:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:241:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:248:5:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:269:42:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:273:42:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:287:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:298:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:309:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:332:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/index.ts:356:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/option.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/manual-algebra/detection/property.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/manual-algebra/detection/result.test.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/manual-algebra/detection/surface.ts:1:1:agent-code-guard/require-stable-file-shell` | unreviewed | pending |
| `src/rules/manual-algebra/detection/surface.ts:100:17:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |
| `src/rules/manual-algebra/detection/surface.ts:101:10:agent-code-guard/prefer-stepdown-function-order` | unreviewed | pending |

## Runtime-cycle inventory

Pending manual inventory. Record every runtime cycle and its reviewed import-evaluation order.

## Unresolved boundaries

Pending review.

## Reviewed partitions and suppressions

Pending review. Each entry must name its evaluation-order or semantic exception.

## Promotion decision

Pending named reviewer approval. Promotion requires no more than 5% false positives, no repeated false-positive category, and zero unexplained Agent Code Guard migration findings.
