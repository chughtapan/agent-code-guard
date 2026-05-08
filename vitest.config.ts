import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true,
      },
    },
    fileParallelism: true,
    isolate: true,
    cache: {
      dir: "node_modules/.cache/vitest",
    },
  },
});
