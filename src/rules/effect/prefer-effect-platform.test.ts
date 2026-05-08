import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./prefer-effect-platform.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
});

ruleTester.run("prefer-effect-platform", rule, {
  valid: [
    // No effect import: raw fs is fine
    {
      code: `
        import * as fs from "fs";
        fs.readFileSync("a");
      `,
    },
    // Effect file using @effect/platform — preferred
    {
      code: `
        import { Effect } from "effect";
        import { FileSystem } from "@effect/platform";
        const program = FileSystem.readFile("a");
      `,
    },
    // disable: fs allows raw fs
    {
      code: `
        import { Effect } from "effect";
        import * as fs from "node:fs";
        fs.readFileSync("a");
      `,
      options: [{ disable: ["fs"] }],
    },
    // disable: argv allows process.argv
    {
      code: `
        import { Effect } from "effect";
        const args = process.argv.slice(2);
      `,
      options: [{ disable: ["argv"] }],
    },
    // disable: fetch allows fetch()
    {
      code: `
        import { Effect } from "effect";
        const res = await fetch("/a");
      `,
      options: [{ disable: ["fetch"] }],
    },
    // disable: sql allows raw kysely
    {
      code: `
        import { Effect } from "effect";
        import { Kysely } from "kysely";
        const db = new Kysely({});
      `,
      options: [{ disable: ["sql"] }],
    },
  ],
  invalid: [
    // Raw fs in Effect file
    {
      code: `
        import { Effect } from "effect";
        import * as fs from "fs";
        fs.readFileSync("a");
      `,
      errors: [{ messageId: "rawFs", data: { module: "fs" } }],
    },
    // node:fs/promises
    {
      code: `
        import { Effect } from "effect";
        import { readFile } from "node:fs/promises";
        await readFile("a");
      `,
      errors: [{ messageId: "rawFs", data: { module: "node:fs/promises" } }],
    },
    // node:http
    {
      code: `
        import { Effect } from "effect";
        import * as http from "node:http";
        http.createServer();
      `,
      errors: [{ messageId: "rawHttp", data: { module: "node:http" } }],
    },
    // process.argv
    {
      code: `
        import { Effect } from "effect";
        const args = process.argv.slice(2);
      `,
      errors: [{ messageId: "rawArgv", data: { module: "process.argv" } }],
    },
    // fetch() call
    {
      code: `
        import { Effect } from "effect";
        const res = await fetch("/a");
      `,
      errors: [{ messageId: "rawFetch", data: { module: "fetch" } }],
    },
    // pg driver
    {
      code: `
        import { Effect } from "effect";
        import { Pool } from "pg";
        const pool = new Pool({});
      `,
      errors: [{ messageId: "rawSql", data: { module: "pg" } }],
    },
    // kysely driver
    {
      code: `
        import { Effect } from "effect";
        import { Kysely } from "kysely";
        const db = new Kysely({});
      `,
      errors: [{ messageId: "rawSql", data: { module: "kysely" } }],
    },
    // yargs CLI
    {
      code: `
        import { Effect } from "effect";
        import yargs from "yargs";
        yargs(process.argv).parse();
      `,
      errors: [
        { messageId: "rawCli", data: { module: "yargs" } },
        { messageId: "rawArgv", data: { module: "process.argv" } },
      ],
    },
    // commander CLI
    {
      code: `
        import { Effect } from "effect";
        import { Command } from "commander";
        new Command();
      `,
      errors: [{ messageId: "rawCli", data: { module: "commander" } }],
    },
    // @effect/* import counts as effect file
    {
      code: `
        import { FileSystem } from "@effect/platform";
        import * as fs from "fs";
        fs.readFileSync("a");
      `,
      errors: [{ messageId: "rawFs", data: { module: "fs" } }],
    },
  ],
});
