import asyncKeyword from "./async-keyword.js";
import bareCatch from "./bare-catch.js";
import noConditionalChaining from "./no-conditional-chaining.js";
import noUnboundedConcurrency from "./no-unbounded-concurrency.js";
import promiseType from "./promise-type.js";
import thenChain from "./then-chain.js";

export const asyncFlowRules = {
  "async-keyword": asyncKeyword,
  "promise-type": promiseType,
  "then-chain": thenChain,
  "bare-catch": bareCatch,
  "no-conditional-chaining": noConditionalChaining,
  "no-unbounded-concurrency": noUnboundedConcurrency,
} as const;
