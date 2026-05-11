/**
 * @file Async-flow rule registry. Exports the family's rule map for the
 * plugin entry; each member rule lives in a sibling file.
 */

import asyncKeyword from "./async-keyword.js";
import bareCatch from "./bare-catch.js";
import noConditionalChaining from "./no-conditional-chaining.js";
import noUnboundedConcurrency from "./no-unbounded-concurrency.js";
import promiseType from "./promise-type.js";
import thenChain from "./then-chain.js";

/**
 * Async-flow rule family. Catches patterns that hide errors or block on
 * Promise-shaped APIs instead of using Effect: stray `async` keywords,
 * raw `Promise` return types, `.then(...)` chains, bare `catch {}` blocks,
 * optional/nullish parameter conditionals, and unbounded fan-out.
 */
export const asyncFlowRules = {
  "async-keyword": asyncKeyword,
  "promise-type": promiseType,
  "then-chain": thenChain,
  "bare-catch": bareCatch,
  "no-conditional-chaining": noConditionalChaining,
  "no-unbounded-concurrency": noUnboundedConcurrency,
} as const;
