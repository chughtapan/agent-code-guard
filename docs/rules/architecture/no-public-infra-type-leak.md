# `agent-code-guard/no-public-infra-type-leak`

**What it flags:** Public API types that mention infrastructure packages such as
Kysely, Pino, Express, Fastify, Prisma, database clients, logging libraries,
transport libraries, or SDK implementation packages.

**Why:** Infrastructure libraries are volatile implementation choices. Exposing
them in public types prevents substitution and forces consumers to carry those
dependencies.

## Before (flagged)

```ts
import type { Kysely } from "kysely";
import type { Logger } from "pino";

export interface ServerHost {
  readonly db: Kysely<Database>;
  readonly logger: Logger;
}
```

## After (preferred)

```ts
export interface StoragePort {
  readonly transaction: <A>(run: () => Promise<A>) => Promise<A>;
}

export interface LogPort {
  readonly info: (message: string, fields?: Record<string, unknown>) => void;
}
```

## Options

```js
{
  "agent-code-guard/no-public-infra-type-leak": ["error", {
    infrastructureTypePackages: ["kysely", "pino", "express", "fastify"]
  }]
}
```
