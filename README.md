# Safer by default

[![npm](https://img.shields.io/npm/v/eslint-plugin-safer-by-default.svg)](https://www.npmjs.com/package/eslint-plugin-safer-by-default)
[![license](https://img.shields.io/npm/l/eslint-plugin-safer-by-default.svg)](./LICENSE)

Your coding agent is miscalibrated.

It was trained on human TypeScript: decades of a language written under one constraint that no longer applies to it, which is that ceremony was expensive for humans. That is why the training corpus is saturated with `async`/`await` and `Promise<T>` return types. That is why it reaches for `throw new Error("bad")` and `as Record<string, unknown>` and `try { ... } catch {}` and `vi.mock(...)`. Those were the right calls when engineering time was scarce. Engineering time is not scarce for an agent. An agent can write two hundred lines of Effect with tagged errors as easily as twenty lines of `async`/`await`.

The agent is calibrated to a workload that does not exist for it. The shortcuts it learned to call "good code" were cost-optimizations for human attention, not quality choices. It defaults to them anyway, because that is what the training data looked like.

This repo is how you recalibrate the agent, on your codebase, automatically.

## How it works

`safer-by-default` is a Claude Code plugin. It ships two skills and an ESLint plugin underneath them.

The first skill, `/safer-by-default:setup`, is invoked once per repo. It detects your existing state, installs `eslint-plugin-safer-by-default` and the rules that pair well with it, writes an `eslint.config.js` you can actually read, flips the TypeScript strict flags, and verifies that the whole thing fires before it calls itself done. If the repo is already wired up, it notices and asks whether you want to verify, reconfigure, update, or walk away.

The second skill, `safer-by-default:typescript`, is invoked automatically whenever the agent writes or reviews TypeScript code in your repo. It carries the full recalibration: the principles, the decision table, the phrases to reject, the mapping from each rule back to the reasoning behind it. The agent reads it before it starts writing, so that when it faces a fork like "do I write an Effect with a tagged error or just `throw new Error`," it picks the one this repo was set up to enforce.

The ESLint plugin is the floor. The skill is the ceiling. The plugin catches the patterns an agent must not ship. The skill describes the patterns it should actively reach for.

## Install

```
/plugin marketplace add chughtapan/safer-by-default
/plugin install safer-by-default@safer-by-default
```

Two slash commands inside Claude Code. No shell, no `mkdir`, no `cp`. Once the plugin is installed, run the setup skill once:

```
/safer-by-default:setup
```

After that, the typescript skill applies itself whenever the agent touches a `.ts` file. You do not invoke it; you do not need to think about it. The floor is enforced every time the lint runs, and the ceiling is pulled into context every time the agent writes TS.

Requires `eslint >= 9` and `typescript >= 5`.

## License

MIT
