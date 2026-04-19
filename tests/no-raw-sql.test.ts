import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-raw-sql.js";

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

ruleTester.run("no-raw-sql", rule, {
  valid: [
    { code: "db.selectFrom('users').selectAll().execute();" },
    { code: "const q = new URLSearchParams(location.search).query;" },
    { code: "router.query('id');" },
    {
      code: "// eslint-disable-next-line @rule-tester/no-raw-sql -- suppression test\ndb.query('SELECT * FROM users');",
    },
    // Non-.query() method calls are not flagged even with SQL content
    { code: "db.exec(`SELECT * FROM users`);" },
    // Bracket-notation .query() is not flagged — only dot-notation .query() calls are in scope
    { code: "db['query'](`SELECT * FROM users`);" },
    // Pure-interpolation template with no static SQL keyword in the head is not flagged
    { code: "client.query(`${foo}`);" },
    // Tagged template with an unknown tag (not sql/SQL) is not flagged
    { code: "db.query(myTag`SELECT * FROM users`);" },
    // Call with no arguments is not flagged
    { code: "db.query();" },
  ],
  invalid: [
    {
      code: "db.query('SELECT * FROM users');",
      errors: [{ messageId: "rawSql" }],
    },
    {
      code: "pool.query('INSERT INTO logs VALUES ($1)', [msg]);",
      errors: [{ messageId: "rawSql" }],
    },
    {
      code: "const rows = await client.query(`UPDATE users SET name = ${name}`);",
      errors: [{ messageId: "rawSql" }],
    },
    {
      code: "db.query(`\n  DELETE FROM sessions WHERE expired = true\n`);",
      errors: [{ messageId: "rawSql" }],
    },
    {
      code: "conn.query('DROP TABLE temp');",
      errors: [{ messageId: "rawSql" }],
    },
    // Tagged template with sql tag is flagged as raw SQL
    {
      code: "db.query(sql`SELECT * FROM users`);",
      errors: [{ messageId: "rawSql" }],
    },
    // Tagged template with SQL tag (uppercase) is also flagged
    {
      code: "db.query(SQL`INSERT INTO logs VALUES ($1)`);",
      errors: [{ messageId: "rawSql" }],
    },
  ],
});
