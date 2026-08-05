/**
 * @file Configures Vitest's cache and threaded isolation behavior for this repository's test suite.
 */

import { configDefaults, defineConfig } from "vitest/config";

// eslint-disable-next-line import-x/no-default-export -- Vitest resolves configuration only from a module's default export.
export default defineConfig({
  cacheDir: "node_modules/.cache/vite",
  test: {
    // Stryker copies the tree into sandboxes while it runs; without this a
    // concurrent test run collects every suite twice.
    exclude: [...configDefaults.exclude, ".stryker-tmp/**"],
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true,
      },
    },
    fileParallelism: true,
    isolate: true,
  },
});
