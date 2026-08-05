import { configDefaults, defineConfig } from "vitest/config";

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
