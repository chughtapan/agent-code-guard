# Safer by default

[![npm](https://img.shields.io/npm/v/eslint-plugin-agent-code-guard.svg)](https://www.npmjs.com/package/eslint-plugin-agent-code-guard)
[![license](https://img.shields.io/npm/l/eslint-plugin-agent-code-guard.svg)](./LICENSE)

Agents don't pay the friction cost of ceremony.

"We'll add types later." "We'll add tests later." "We'll add validation later." These were real tradeoffs when engineering time was scarce. Engineering time isn't scarce anymore.

The floor of code quality in AI-written TypeScript can be higher than any human team could reasonably maintain. Strong types. Schemas at every boundary. Typed errors. No silent catches. Real-dependency integration tests. The ceremony humans skipped because it wasn't worth their time takes seconds for an agent to write. Those same seconds prevent hours of debugging later.

This repo is how you enforce it.

## Install

```
/plugin marketplace add chughtapan/agent-code-guard
/plugin install safer-by-default@agent-code-guard
```

Two slash commands inside Claude Code. No shell. Once installed, the plugin ships two skills:

- `/safer-by-default:setup` — user-invoked once per repo. Installs `eslint-plugin-agent-code-guard`, writes `eslint.config.js`, flips the `tsconfig.json` strict flags, and adds adjacent rules worth pairing. Asks you which stack you're on (Effect? Kysely?) and what your integration-test glob is.
- `safer-by-default:typescript` — auto-invoked by Claude Code whenever the agent writes or reviews TypeScript. The in-band principles: strong types, schemas at boundaries, typed errors, no silent catches, Effect + Kysely patterns. You don't type this one.

Requires `eslint >= 9`, `typescript >= 5`.

## License

MIT
