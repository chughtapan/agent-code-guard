import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/bare-catch.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
});

ruleTester.run("bare-catch", rule, {
  valid: [
    { code: "try { doThing(); } catch (err) { console.error(err); }" },
    { code: "try { doThing(); } catch (error) { log(error); }" },
    { code: "try { doThing(); } catch (e) { throw e; }" },
    {
      code: "// eslint-disable-next-line @rule-tester/bare-catch -- suppression test (real prefix in production is `agent-code-guard/bare-catch`)\ntry { doThing(); } catch {}",
    },
  ],
  invalid: [
    {
      code: "try { doThing(); } catch {}",
      errors: [{ messageId: "bareCatch" }],
    },
    {
      code: "try { doThing(); } catch (_) {}",
      errors: [{ messageId: "bareCatch" }],
    },
    {
      code: "try { doThing(); } catch (_err) { /* ignore */ }",
      errors: [{ messageId: "bareCatch" }],
    },
    {
      code: "try { doThing(); } catch (_unused) { return; }",
      errors: [{ messageId: "bareCatch" }],
    },
    {
      code: "async function run() { try { await x(); } catch {} }",
      errors: [
        { messageId: "bareCatch" },
      ],
    },
  ],
});
