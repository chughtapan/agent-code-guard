# Safer by default

[![npm](https://img.shields.io/npm/v/eslint-plugin-agent-code-guard.svg)](https://www.npmjs.com/package/eslint-plugin-agent-code-guard)
[![license](https://img.shields.io/npm/l/eslint-plugin-agent-code-guard.svg)](./LICENSE)

Agents don't pay the friction cost of ceremony.

"We'll add types later." "We'll add tests later." "We'll add validation later." These were real tradeoffs when engineering time was scarce. Engineering time isn't scarce anymore.

The floor of code quality in AI-written TypeScript can be higher than any human team could reasonably maintain. Strong types. Schemas at every boundary. Typed errors. No silent catches. Real-dependency integration tests. The ceremony humans skipped because it wasn't worth their time takes seconds for an agent to write. Those same seconds prevent hours of debugging later.

This package is how you enforce it.

## Install the skill

The primary way to adopt this is the companion Claude Code skill, `/safer-by-default`. It installs the ESLint plugin, writes `eslint.config.js`, flips the `tsconfig.json` strict flags, and recommends adjacent rules worth pairing. You don't wire any of it up by hand.

```sh
pnpm add -D eslint-plugin-agent-code-guard @typescript-eslint/parser
mkdir -p .claude/skills/safer-by-default
cp node_modules/eslint-plugin-agent-code-guard/SKILL.md .claude/skills/safer-by-default/SKILL.md
```

Then in any Claude Code session in that repo:

> /safer-by-default

The skill takes over. It asks you which stack you're on, what your integration-test glob is, and what's already wired. Then it does the rest.

Requires `eslint >= 9`, `typescript >= 5`.

## License

MIT
